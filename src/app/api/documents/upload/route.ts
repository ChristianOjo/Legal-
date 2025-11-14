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
// Increase timeout for document processing (Vercel Pro: up to 300s, Hobby: 10s)
// Note: Processing happens async, so this mainly affects the initial upload response
export const maxDuration = 60; // 60 seconds

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

    // Start async processing (don't await - let it run in background)
    processDocumentAsync(document.id, userId, buffer, file.name, file.type).catch(
      (error) => {
        console.error(`Background processing error for document ${document.id}:`, error);
        // Error is already handled in processDocumentAsync
      }
    );

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
    const errorMessage =
      error instanceof Error ? error.message : "Failed to upload document";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
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
    console.log(`Starting processing for document ${documentId} (${filename})`);
    
    // Step 1: Extract text from document
    console.log(`[${documentId}] Extracting text...`);
    const processed = await processDocument(buffer, filename, fileType);
    const cleanedText = cleanLegalText(processed.text);
    
    // Step 2: Chunk the document
    console.log(`[${documentId}] Chunking document (${cleanedText.length} chars)...`);
    const chunks = await chunkDocument(cleanedText, filename, {
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    console.log(`[${documentId}] Created ${chunks.length} chunks`);

    // Step 3: Generate embeddings
    console.log(`[${documentId}] Generating embeddings...`);
    const texts = chunks.map((chunk) => chunk.content);
    const embeddings = await generateEmbeddingsBatch(texts);
    console.log(`[${documentId}] Generated ${embeddings.length} embeddings`);

    // Step 4: Upsert to vector store
    console.log(`[${documentId}] Upserting vectors to Pinecone...`);
    const vectorIds = await upsertVectors(embeddings, chunks, documentId, userId, fileType);
    console.log(`[${documentId}] Upserted ${vectorIds.length} vectors`);

    // Step 5: Save chunks to database
    console.log(`[${documentId}] Saving chunks to database...`);
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
      const { error } = await supabaseAdmin.from("document_chunks").insert(batch);
      if (error) {
        throw new Error(`Failed to insert chunks batch: ${error.message}`);
      }
    }

    // Step 6: Update document status
    const { error: updateError } = await supabaseAdmin
      .from("documents")
      .update({
        status: "completed",
        total_chunks: chunks.length,
        metadata: {
          ...processed.metadata,
          totalChunks: chunks.length,
          wordCount: processed.metadata.wordCount, // Store in metadata
        },
      })
      .eq("id", documentId);

    if (updateError) {
      throw new Error(`Failed to update document status: ${updateError.message}`);
    }

    console.log(`[${documentId}] Document processed successfully`);
  } catch (error) {
    console.error(`[${documentId}] Error processing document:`, error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    // Try to update status to failed
    try {
      await supabaseAdmin
        .from("documents")
        .update({
          status: "failed",
          metadata: { error: errorMessage },
        })
        .eq("id", documentId);
    } catch (updateError) {
      console.error(`[${documentId}] Failed to update error status:`, updateError);
    }
  }
}
