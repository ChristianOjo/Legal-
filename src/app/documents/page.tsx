"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  UploadCloud,
  FileText,
  Trash2,
  Loader2,
  CheckCircle,
  AlertTriangle,
  MessageSquare,
} from "lucide-react";
import Link from "next/link";

// --- Types ---
interface Document {
  id: string;
  filename: string;
  status: "processing" | "completed" | "failed";
  word_count: number;
  created_at: string;
}

// --- Document List Component ---
const DocumentList = ({
  documents,
  onDelete,
}: {
  documents: Document[];
  onDelete: (id: string) => void;
}) => {
  if (documents.length === 0) {
    return (
      <div className="text-center py-12 border border-dashed border-border rounded-xl mt-8 bg-card/50 backdrop-blur-sm">
        <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium text-foreground">No Documents Uploaded</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a legal document to get started with your AI advisor.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-4">
      {documents.map((doc) => (
        <div
          key={doc.id}
          className="flex items-center justify-between p-4 bg-card rounded-xl border border-border card-shadow transition-all hover:shadow-md"
        >
          <div className="flex items-center space-x-4">
            <FileText className="w-6 h-6 text-primary" />
            <div>
              <p className="font-medium text-foreground truncate max-w-xs">
                {doc.filename}
              </p>
              <p className="text-sm text-muted-foreground">
                {doc.word_count.toLocaleString()} words |{" "}
                {new Date(doc.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {doc.status === "processing" && (
              <span className="flex items-center text-sm text-yellow-400">
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                Processing...
              </span>
            )}
            {doc.status === "completed" && (
              <>
                <span className="flex items-center text-sm text-green-400">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Ready
                </span>
                <Link
                  href={`/chat?docId=${doc.id}`}
                  className="p-2 rounded-full text-primary-foreground bg-primary hover:bg-primary/90 transition-colors"
                  title="Start Chat"
                >
                  <MessageSquare className="w-5 h-5" />
                </Link>
              </>
            )}
            {doc.status === "failed" && (
              <span className="flex items-center text-sm text-red-400">
                <AlertTriangle className="w-4 h-4 mr-1" />
                Failed
              </span>
            )}

            <button
              onClick={() => onDelete(doc.id)}
              className="p-2 rounded-full text-red-400 hover:bg-secondary transition-colors"
              title="Delete Document"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

// --- Upload Form Component ---
const UploadForm = ({ onUploadSuccess }: { onUploadSuccess: () => void }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setSuccess(null);
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      const maxSize = 10 * 1024 * 1024; // 10MB
      const allowedTypes = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
      ];

      if (selectedFile.size > maxSize) {
        setError("File size exceeds 10MB limit.");
        setFile(null);
        return;
      }

      if (!allowedTypes.includes(selectedFile.type)) {
        setError("Unsupported file type. Please use PDF, DOCX, or TXT.");
        setFile(null);
        return;
      }

      setFile(selectedFile);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please select a file to upload.");
      return;
    }

    setIsUploading(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        setSuccess("Document uploaded and processing started!");
        setFile(null);
        onUploadSuccess(); // Refresh document list
      } else {
        const data = await response.json();
        setError(data.error || "Upload failed. Please try again.");
      }
    } catch (err) {
      setError("Network error during upload.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="p-6 bg-card rounded-xl border border-border card-shadow"
    >
      <h2 className="text-xl font-semibold text-foreground mb-4">
        Upload New Document
      </h2>

      <div className="flex items-center justify-center w-full">
        <label
          htmlFor="dropzone-file"
          className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
            file
              ? "border-primary bg-secondary"
              : "border-border hover:border-muted-foreground bg-secondary/50 hover:bg-secondary"
          }`}
        >
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <UploadCloud className="w-8 h-8 mb-3 text-muted-foreground" />
            <p className="mb-2 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-muted-foreground">
              PDF, DOCX, or TXT (Max 10MB)
            </p>
            {file && (
              <p className="mt-2 text-sm font-medium text-primary">
                Selected: {file.name}
              </p>
            )}
          </div>
          <input
            id="dropzone-file"
            type="file"
            className="hidden"
            onChange={handleFileChange}
            accept=".pdf,.docx,.txt"
          />
        </label>
      </div>

      {error && (
        <div className="mt-4 p-3 text-sm text-red-400 bg-red-900/50 rounded-xl border border-red-900">
          {error}
        </div>
      )}
      {success && (
        <div className="mt-4 p-3 text-sm text-green-400 bg-green-900/50 rounded-xl border border-green-900">
          {success}
        </div>
      )}

      <button
        type="submit"
        disabled={!file || isUploading}
        className="w-full mt-4 flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors disabled:opacity-50"
      >
        {isUploading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Uploading...
          </>
        ) : (
          <>
            <UploadCloud className="w-5 h-5 mr-2" />
            Start Processing
          </>
        )}
      </button>
    </form>
  );
};

// --- Main Page Component ---
export default function DocumentsPage() {
  const { data: session, status } = useSession();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Function to fetch documents
  // Function to fetch documents
  const fetchDocuments = async () => {
    if (status !== "authenticated") return;
    setIsLoading(true);
    try {
      // NOTE: You will need to create this API route: /api/documents
      const response = await fetch("/api/documents");
      if (response.ok) {
        const data = await response.json();
        // Sort by creation date, newest first
        setDocuments(data.sort((a: Document, b: Document) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      } else {
        console.error("Failed to fetch documents");
      }
    } catch (error) {
      console.error("Error fetching documents:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    if (status === "authenticated") {
      fetchDocuments();
    }
  }, [status]);

  // Periodic refresh only if there are documents in 'processing' state
  useEffect(() => {
    const hasProcessingDocs = documents.some(doc => doc.status === "processing");
    
    let interval: NodeJS.Timeout | undefined;
    if (status === "authenticated" && hasProcessingDocs) {
      // Set up a refresh interval to check processing status
      interval = setInterval(fetchDocuments, 10000); // Refresh every 10 seconds
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [status, documents]);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this document?")) return;

    try {
      // NOTE: You will need to create this API route: /api/documents/[id] with DELETE method
      const response = await fetch(`/api/documents/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        // Optimistically update the UI
        setDocuments(documents.filter((doc) => doc.id !== id));
      } else {
        alert("Failed to delete document.");
      }
    } catch (error) {
      alert("Network error during deletion.");
    }
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-foreground">Access Denied</h2>
        <p className="mt-2 text-muted-foreground">Please log in to view your documents.</p>
        <Link href="/login" className="mt-4 inline-block text-primary hover:text-primary/80">
          Go to Login
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-foreground">Your Legal Documents</h1>

      <UploadForm onUploadSuccess={fetchDocuments} />

      <h2 className="text-2xl font-semibold text-foreground pt-4 border-t border-border">
        Uploaded Files
      </h2>
      <DocumentList documents={documents} onDelete={handleDelete} />
    </div>
  );
}

