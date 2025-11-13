"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import {
  Send,
  Loader2,
  MessageSquare,
  FileText,
  User,
  Zap,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";

// --- Types ---
interface Message {
  id: number;
  content: string;
  role: "user" | "assistant";
}

interface Document {
  id: string;
  filename: string;
  status: "processing" | "completed" | "failed";
}

// --- Message Bubble Component ---
const MessageBubble = ({ message }: { message: Message }) => {
  const isUser = message.role === "user";
  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}
    >
      <div
        className={`flex items-start max-w-3xl p-4 rounded-2xl shadow-md ${
          isUser
            ? "bg-blue-500 text-white rounded-br-none"
            : "bg-white text-gray-800 rounded-tl-none border border-gray-200"
        }`}
      >
        <div className="mr-3">
          {isUser ? (
            <User className="w-5 h-5" />
          ) : (
            <Zap className="w-5 h-5 text-blue-500" />
          )}
        </div>
        <p className="whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  );
};

// --- Main Chat Component ---
export default function ChatPage() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const docId = searchParams.get("docId");

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [currentDocument, setCurrentDocument] = useState<Document | null>(null);
  const [availableDocuments, setAvailableDocuments] = useState<Document[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Fetch documents on load
  useEffect(() => {
    const fetchDocuments = async () => {
      if (status !== "authenticated") return;
      try {
        // NOTE: You will need to create this API route: /api/documents
        const response = await fetch("/api/documents");
        if (response.ok) {
          const data: Document[] = await response.json();
          setAvailableDocuments(data.filter(d => d.status === 'completed'));
        }
      } catch (error) {
        console.error("Error fetching documents:", error);
      }
    };
    fetchDocuments();
  }, [status]);

  // Set current document based on URL param
  useEffect(() => {
    if (docId && availableDocuments.length > 0) {
      const doc = availableDocuments.find(d => d.id === docId);
      if (doc) {
        setCurrentDocument(doc);
        setMessages([
          {
            id: 1,
            role: "assistant",
            content: `Hello! I'm your Celestius Legal AI Advisor. I've loaded the document "${doc.filename}". How can I help you analyze it?`,
          },
        ]);
      }
    } else if (availableDocuments.length > 0 && !docId) {
        // If no docId but docs exist, prompt user to select one
        setCurrentDocument(null);
        setMessages([
            {
                id: 1,
                role: "assistant",
                content: "Welcome to your Legal AI Advisor. Please select a document from the sidebar or upload a new one to begin analysis."
            }
        ])
    }
  }, [docId, availableDocuments]);

  // Scroll on message update
  useEffect(scrollToBottom, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSending || !currentDocument) return;

    const userMessage: Message = {
      id: Date.now(),
      content: input.trim(),
      role: "user",
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: currentDocument.id,
          message: userMessage.content,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const aiMessage: Message = {
          id: Date.now() + 1,
          content: data.response,
          role: "assistant",
        };
        setMessages((prev) => [...prev, aiMessage]);
      } else {
        const errorData = await response.json();
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            role: "assistant",
            content: `Error: ${errorData.error || "Could not get a response from the AI."}`,
          },
        ]);
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "assistant",
          content: "Network error: Could not connect to the chat service.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900">Access Denied</h2>
        <p className="mt-2 text-gray-600">Please log in to use the chat advisor.</p>
        <Link href="/login" className="mt-4 inline-block text-blue-600 hover:text-blue-700">
          Go to Login
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-100px)] max-h-[900px] rounded-3xl overflow-hidden shadow-2xl card-shadow">
      {/* Document Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 p-4 flex flex-col">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
          <FileText className="w-5 h-5 mr-2 text-blue-500" />
          Documents
        </h2>
        <div className="flex-1 overflow-y-auto space-y-2">
          {availableDocuments.length === 0 ? (
            <div className="text-center p-4 text-sm text-gray-500 bg-gray-50 rounded-xl">
              No completed documents. <Link href="/documents" className="text-blue-500 hover:underline">Upload one?</Link>
            </div>
          ) : (
            availableDocuments.map((doc) => (
              <Link
                key={doc.id}
                href={`/chat?docId=${doc.id}`}
                className={`block p-3 rounded-xl transition-colors duration-150 border ${
                  currentDocument?.id === doc.id
                    ? "bg-blue-500 text-white border-blue-500 shadow-md"
                    : "bg-gray-50 text-gray-700 hover:bg-gray-100 border-gray-100"
                }`}
              >
                <p className="text-sm font-medium truncate">{doc.filename}</p>
              </Link>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-gray-50">
        {/* Chat Header */}
        <div className="p-4 border-b border-gray-200 bg-white/80 backdrop-blur-md">
          <h3 className="text-lg font-semibold text-gray-900">
            {currentDocument ? (
              <>
                Advisor for: <span className="text-blue-600">{currentDocument.filename}</span>
              </>
            ) : (
              "Select a Document to Begin"
            )}
          </h3>
        </div>

        {/* Messages */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          {isSending && (
            <div className="flex justify-start">
              <div className="flex items-center p-3 rounded-2xl bg-white text-gray-800 rounded-tl-none border border-gray-200 shadow-md">
                <Loader2 className="w-4 h-4 mr-2 animate-spin text-blue-500" />
                <p className="text-sm">AI is thinking...</p>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <div className="p-4 border-t border-gray-200 bg-white/80 backdrop-blur-md">
          <form onSubmit={handleSend} className="flex space-x-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={currentDocument ? "Ask a question about the document..." : "Please select a document first."}
              disabled={isSending || !currentDocument}
              className="flex-1 p-3 border border-gray-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 transition-colors disabled:bg-gray-100"
            />
            <button
              type="submit"
              disabled={isSending || !input.trim() || !currentDocument}
              className="p-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:bg-blue-300 disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

