import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { supabaseClient } from "@/lib/supabase";

// NOTE: This file is a placeholder. You will need to implement the actual logic
// to fetch documents from your database.

export async function GET(request: Request) {
  const session = await getServerSession();

  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Assuming your session token contains the user ID
  const userId = (session.user as any).id;

  try {
    // Fetch documents belonging to the current user
    const { data: documents, error } = await supabaseClient
      .from("documents")
      .select("id, filename, status, metadata, created_at")
      .eq("user_id", userId);

    if (error) {
      console.error("Supabase error fetching documents:", error);
      return NextResponse.json(
        { error: "Failed to fetch documents" },
        { status: 500 }
      );
    }

    // Transform documents to include word_count from metadata
    const transformedDocuments = (documents || []).map((doc: any) => ({
      id: doc.id,
      filename: doc.filename,
      status: doc.status,
      word_count: doc.metadata?.wordCount || 0,
      created_at: doc.created_at,
    }));

    return NextResponse.json(transformedDocuments);
  } catch (error) {
    console.error("Internal server error fetching documents:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

