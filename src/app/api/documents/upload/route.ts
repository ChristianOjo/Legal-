import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import {
  processDocument,
  chunkDocument,
  cleanLegalText,
} from "@/lib/document-processor";
import { generateEmbeddingsBatch } from "@/lib/embeddings";
import { upsertVectors } from "@/lib/vector-store";

export const config = {
  api: {
    bodyParser: false, // Disable body parsing for file uploads
  },
};

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Parse form data
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File size exceeds 10MB limit" },
        { status: 400 }
      );
    }

    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only PDF, DOCX, and TXT are supported" },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create document record in database
    const { data: document, error: dbError } = await supabaseAdmin
      .from("documents")
      .insert({
        user_id: userId,
        title: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
        filename: file.name,
        file_type: file.type,
        file_size: file.size,
        status: "processing",
      })
      .select()
      .single();

    if (dbError || !document) {
      console.error("Error creating document record:", dbError);
      return NextResponse.json(
        { error: "Failed to create document record" },
        { status: 500 }
      );
    }

    // Process document asynchronously
    processDocumentAsync(document.id, userId, buffer, file.name, file.type);

    return NextResponse.json(
      {
        message: "Document uploaded successfully and processing",
        document: {
          id: document.id,
          title: document.title,
          filename: document.filename,
          status: document.status,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error uploading document:", error);
    return NextResponse.json(
      { error: "Failed to upload document" },
      { status: 500 }
    );
  }
}

/**
 * Process document asynchronously
 */
async function processDocumentAsync(
  documentId: string,
  userId: string,
  buffer: Buffer,
  filename: string,
  fileType: string
) {
  try {
    // Extract text from document
    const processed = await processDocument(buffer, filename, fileType);

    // Clean legal text
    const cleanedText = cleanLegalText(processed.text);

    // Chunk document
    const chunks = await chunkDocument(cleanedText, filename, {
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    // Generate embeddings for chunks
    const texts = chunks.map((chunk) => chunk.content);
    const embeddings = await generateEmbeddingsBatch(texts);

    // Store in Pinecone
    const vectorIds = await upsertVectors(
      embeddings,
      chunks,
      documentId,
      userId,
      fileType
    );

    // Store chunks in database
    const chunkRecords = chunks.map((chunk, index) => ({
      document_id: documentId,
      chunk_index: index,
      content: chunk.content,
      metadata: chunk.metadata,
      vector_id: vectorIds[index],
    }));

    // Insert chunks in batches
    const batchSize = 100;
    for (let i = 0; i < chunkRecords.length; i += batchSize) {
      const batch = chunkRecords.slice(i, i + batchSize);
      await supabaseAdmin.from("document_chunks").insert(batch);
    }

    // Update document status
    await supabaseAdmin
      .from("documents")
      .update({
        status: "completed",
        total_chunks: chunks.length,
        metadata: {
          ...processed.metadata,
          totalChunks: chunks.length,
        },
      })
      .eq("id", documentId);

    console.log(`Document ${documentId} processed successfully`);
  } catch (error) {
    console.error(`Error processing document ${documentId}:`, error);

    // Update document status to failed
    await supabaseAdmin
      .from("documents")
      .update({
        status: "failed",
        metadata: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      })
      .eq("id", documentId);
  }
}