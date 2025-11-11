import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("count")
      .limit(1);

    if (error) throw error;

    return NextResponse.json({ success: true, message: "Database connected!" });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) });
  }
}