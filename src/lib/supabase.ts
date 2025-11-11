import { createClient } from "@supabase/supabase-js";

// Client for browser usage
export const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Admin client for server-side operations
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Database types
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          name: string | null;
          password_hash: string | null;
          email_verified: string | null;
          image: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          name?: string | null;
          password_hash?: string | null;
          email_verified?: string | null;
          image?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string | null;
          password_hash?: string | null;
          email_verified?: string | null;
          image?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      documents: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          filename: string;
          file_type: string;
          file_size: number | null;
          storage_path: string | null;
          status: string;
          metadata: any;
          total_chunks: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          filename: string;
          file_type: string;
          file_size?: number | null;
          storage_path?: string | null;
          status?: string;
          metadata?: any;
          total_chunks?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          filename?: string;
          file_type?: string;
          file_size?: number | null;
          storage_path?: string | null;
          status?: string;
          metadata?: any;
          total_chunks?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      document_chunks: {
        Row: {
          id: string;
          document_id: string;
          chunk_index: number;
          content: string;
          metadata: any;
          vector_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          chunk_index: number;
          content: string;
          metadata?: any;
          vector_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          document_id?: string;
          chunk_index?: number;
          content?: string;
          metadata?: any;
          vector_id?: string | null;
          created_at?: string;
        };
      };
      conversations: {
        Row: {
          id: string;
          user_id: string;
          title: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          role: string;
          content: string;
          sources: any[];
          metadata: any;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          role: string;
          content: string;
          sources?: any[];
          metadata?: any;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          role?: string;
          content?: string;
          sources?: any[];
          metadata?: any;
          created_at?: string;
        };
      };
    };
  };
}