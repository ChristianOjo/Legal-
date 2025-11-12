import mammoth from "mammoth";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

export interface ProcessedDocument {
  text: string;
  metadata: {
    filename: string;
    fileType: string;
    pageCount?: number;
    wordCount: number;
  };
}

export interface DocumentChunk {
  content: string;
  metadata: {
    chunkIndex: number;
    startChar: number;
    endChar: number;
    filename: string;
  };
}

/**
 * Extract text from PDF file
 */
export async function extractTextFromPDF(
  buffer: Buffer
): Promise<ProcessedDocument> {
  try {
    // Dynamically import pdf-parse ONLY when this function is called
    const pdf = (await import("pdf-parse")).default;
    const data = await pdf(buffer);

    return {
      text: data.text,
      metadata: {
        filename: "",
        fileType: "pdf",
        pageCount: data.numpages,
        wordCount: data.text.split(/\s+/).length,
      },
    };
  } catch (error) {
    console.error("Error extracting PDF text:", error);
    throw new Error("Failed to extract text from PDF");
  }
}

/**
 * Extract text from DOCX file
 */
export async function extractTextFromDOCX(
  buffer: Buffer
): Promise<ProcessedDocument> {
  try {
    const result = await mammoth.extractRawText({ buffer });

    return {
      text: result.value,
      metadata: {
        filename: "",
        fileType: "docx",
        wordCount: result.value.split(/\s+/).length,
      },
    };
  } catch (error) {
    console.error("Error extracting DOCX text:", error);
    throw new Error("Failed to extract text from DOCX");
  }
}

/**
 * Extract text from TXT file
 */
export async function extractTextFromTXT(
  buffer: Buffer
): Promise<ProcessedDocument> {
  try {
    const text = buffer.toString("utf-8");

    return {
      text,
      metadata: {
        filename: "",
        fileType: "txt",
        wordCount: text.split(/\s+/).length,
      },
    };
  } catch (error) {
    console.error("Error extracting TXT text:", error);
    throw new Error("Failed to extract text from TXT");
  }
}

/**
 * Process document based on file type
 */
export async function processDocument(
  buffer: Buffer,
  filename: string,
  fileType: string
): Promise<ProcessedDocument> {
  let result: ProcessedDocument;

  switch (fileType.toLowerCase()) {
    case "pdf":
    case "application/pdf":
      result = await extractTextFromPDF(buffer);
      break;
    case "docx":
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      result = await extractTextFromDOCX(buffer);
      break;
    case "txt":
    case "text/plain":
      result = await extractTextFromTXT(buffer);
      break;
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }

  result.metadata.filename = filename;
  return result;
}

/**
 * Chunk document text for vector storage
 * Uses overlapping chunks to maintain context
 */
export async function chunkDocument(
  text: string,
  filename: string,
  options: {
    chunkSize?: number;
    chunkOverlap?: number;
  } = {}
): Promise<DocumentChunk[]> {
  const { chunkSize = 1000, chunkOverlap = 200 } = options;

  // Create text splitter optimized for legal documents
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize,
    chunkOverlap,
    separators: [
      "\n\n\n", // Major section breaks
      "\n\n",   // Paragraph breaks
      "\n",     // Line breaks
      ". ",     // Sentence breaks
      " ",      // Word breaks
      "",       // Character breaks
    ],
  });

  const chunks = await splitter.createDocuments([text]);

  return chunks.map((chunk, index) => ({
    content: chunk.pageContent,
    metadata: {
      chunkIndex: index,
      startChar: index * (chunkSize - chunkOverlap),
      endChar: index * (chunkSize - chunkOverlap) + chunk.pageContent.length,
      filename,
    },
  }));
}

/**
 * Validate file size and type
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  const maxSize = 10 * 1024 * 1024; // 10MB
  const allowedTypes = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
  ];

  if (file.size > maxSize) {
    return {
      valid: false,
      error: "File size exceeds 10MB limit",
    };
  }

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: "File type not supported. Please upload PDF, DOCX, or TXT files.",
    };
  }

  return { valid: true };
}

/**
 * Clean and normalize text for legal documents
 */
export function cleanLegalText(text: string): string {
  return text
    // Remove excessive whitespace
    .replace(/\s+/g, " ")
    // Remove page numbers (common pattern)
    .replace(/\n\s*\d+\s*\n/g, "\n")
    // Normalize quotes
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    // Remove zero-width spaces
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    // Trim
    .trim();
}
