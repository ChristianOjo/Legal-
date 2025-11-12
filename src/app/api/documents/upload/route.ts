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

// Next.js 14+ route exports
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

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

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const { data: document, error: dbError } = await supabaseAdmin
      .from("documents")
      .insert({
        user_id: userId,
        title: file.name.replace(/\.[^/.]+$/, ""),
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
    return NextResponse.json({ error: "Failed to upload document" }, { status: 500 });
  }
}

// --------------------
// Async document processing
// --------------------
async function processDocumentAsync(
  documentId: string,
  userId: string,
  buffer: Buffer,
  filename: string,
  fileType: string
) {
  try {
    const processed = await processDocument(buffer, filename, fileType);
    const cleanedText = cleanLegalText(processed.text);
    const chunks = await chunkDocument(cleanedText, filename, {
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const texts = chunks.map((chunk) => chunk.content);
    const embeddings = await generateEmbeddingsBatch(texts);

    const vectorIds = await upsertVectors(embeddings, chunks, documentId, userId, fileType);

    const chunkRecords = chunks.map((chunk, index) => ({
      document_id: documentId,
      chunk_index: index,
      content: chunk.content,
      metadata: chunk.metadata,
      vector_id: vectorIds[index],
    }));

    const batchSize = 100;
    for (let i = 0; i < chunkRecords.length; i += batchSize) {
      const batch = chunkRecords.slice(i, i + batchSize);
      await supabaseAdmin.from("document_chunks").insert(batch);
    }

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

    await supabaseAdmin
      .from("documents")
      .update({
        status: "failed",
        metadata: { error: error instanceof Error ? error.message : "Unknown error" },
      })
      .eq("id", documentId);
  }
}
