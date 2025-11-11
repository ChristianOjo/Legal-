import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { generateQueryEmbedding } from "@/lib/embeddings";
import { queryVectors } from "@/lib/vector-store";
import {
  generateResponse,
  generateStreamingResponse,
  analyzeQuery,
  type ChatMessage,
  type Source,
} from "@/lib/groq";

export const maxDuration = 60; // Vercel serverless function timeout

interface ChatRequest {
  message: string;
  conversationId?: string;
  stream?: boolean;
}

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const body: ChatRequest = await req.json();
    const { message, conversationId, stream = false } = body;

    if (!message || message.trim().length === 0) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Get or create conversation
    let convId = conversationId;
    if (!convId) {
      const { data: newConversation, error } = await supabaseAdmin
        .from("conversations")
        .insert({
          user_id: userId,
          title: message.slice(0, 100), // Use first 100 chars as title
        })
        .select()
        .single();

      if (error || !newConversation) {
        return NextResponse.json(
          { error: "Failed to create conversation" },
          { status: 500 }
        );
      }

      convId = newConversation.id;
    }

    // Store user message
    await supabaseAdmin.from("messages").insert({
      conversation_id: convId,
      role: "user",
      content: message,
    });

    // Generate query embedding
    const queryEmbedding = await generateQueryEmbedding(message);

    // Retrieve relevant documents from vector store
    const retrievedVectors = await queryVectors(queryEmbedding, userId, {
      topK: 5,
      minScore: 0.7,
    });

    // Format sources
    const sources: Source[] = retrievedVectors.map((vector) => ({
      documentId: vector.metadata.documentId,
      filename: vector.metadata.filename,
      content: vector.metadata.content,
      score: vector.score,
      chunkIndex: vector.metadata.chunkIndex,
    }));

    // Analyze if query can be answered
    const analysis = await analyzeQuery(message, sources);

    if (!analysis.canAnswer) {
      const response = `I apologize, but I don't have sufficient information in the uploaded documents to answer your question accurately.

${analysis.reasoning}

Please ensure you've uploaded relevant legal documents that contain information about your query. You can upload documents using the upload feature.

**Disclaimer:** This system provides information based solely on uploaded documents and is not a substitute for professional legal advice.`;

      // Store assistant response
      await supabaseAdmin.from("messages").insert({
        conversation_id: convId,
        role: "assistant",
        content: response,
        sources: [],
        metadata: { analysis },
      });

      return NextResponse.json({
        response,
        sources: [],
        conversationId: convId,
        metadata: { analysis },
      });
    }

    // Get conversation history
    const { data: history } = await supabaseAdmin
      .from("messages")
      .select("role, content")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true })
      .limit(6);

    const conversationHistory: ChatMessage[] =
      history?.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })) || [];

    // Handle streaming response
    if (stream) {
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          try {
            let fullResponse = "";

            for await (const chunk of generateStreamingResponse(
              message,
              sources,
              conversationHistory
            )) {
              fullResponse += chunk;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ chunk })}\n\n`)
              );
            }

            // Store complete response
            await supabaseAdmin.from("messages").insert({
              conversation_id: convId,
              role: "assistant",
              content: fullResponse,
              sources: sources.map((s) => ({
                documentId: s.documentId,
                filename: s.filename,
                score: s.score,
                chunkIndex: s.chunkIndex,
              })),
              metadata: { analysis },
            });

            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ done: true, conversationId: convId })}\n\n`
              )
            );
            controller.close();
          } catch (error) {
            console.error("Streaming error:", error);
            controller.error(error);
          }
        },
      });

      return new NextResponse(readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // Generate non-streaming response
    const { content: response } = await generateResponse(
      message,
      sources,
      conversationHistory
    );

    // Store assistant response
    await supabaseAdmin.from("messages").insert({
      conversation_id: convId,
      role: "assistant",
      content: response,
      sources: sources.map((s) => ({
        documentId: s.documentId,
        filename: s.filename,
        score: s.score,
        chunkIndex: s.chunkIndex,
      })),
      metadata: { analysis },
    });

    return NextResponse.json({
      response,
      sources: sources.map((s) => ({
        filename: s.filename,
        score: s.score,
        preview: s.content.slice(0, 200) + "...",
      })),
      conversationId: convId,
      metadata: { analysis },
    });
  } catch (error) {
    console.error("Error in chat endpoint:", error);
    return NextResponse.json(
      { error: "Failed to process chat message" },
      { status: 500 }
    );
  }
}