import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { supabaseClient } from "@/lib/supabase";

// NOTE: This file is a placeholder. You will need to implement the actual logic
// to delete a document from your database.

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession();

  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const documentId = params.id;
  const userId = (session.user as any).id;

  try {
    // 1. Delete the document from the database, ensuring it belongs to the user
    const { error: dbError } = await supabaseClient
      .from("documents")
      .delete()
      .eq("id", documentId)
      .eq("user_id", userId);

    if (dbError) {
      console.error("Supabase error deleting document:", dbError);
      return NextResponse.json(
        { error: "Failed to delete document" },
        { status: 500 }
      );
    }

    // 2. (Optional but recommended) Delete the associated vectors from your vector store
    // This step depends on your vector database implementation (e.g., Pinecone, Chroma, Supabase pgvector)
    // Since we don't know your vector store, this is left as a comment.
    // Example: await vectorStore.delete({ filter: { documentId: documentId } });

    return NextResponse.json({ message: "Document deleted successfully" });
  } catch (error) {
    console.error("Internal server error deleting document:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

