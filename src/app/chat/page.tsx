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
  Sparkles,
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

// Suggested prompts for first-time users
const SUGGESTED_PROMPTS = [
  "What are the main legal obligations in this document?",
  "Summarize the key terms and conditions",
  "What are the important deadlines or dates mentioned?",
  "Explain the liability clauses",
  "What are the termination conditions?",
  "Identify any potential risks or concerns",
];

// --- Message Bubble Component ---
const MessageBubble = ({ message }: { message: Message }) => {
  const isUser = message.role === "user";
  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}
    >
      <div
        className={`flex items-start max-w-3xl p-4 rounded-lg ${
          isUser
            ? "bg-primary text-primary-foreground rounded-br-none"
            : "bg-card text-foreground rounded-tl-none border border-border"
        }`}
      >
        <div className="mr-3">
          {isUser ? (
            <User className="w-5 h-5" />
          ) : (
            <Zap className="w-5 h-5 text-primary" />
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
        // Clear messages to show suggested prompts instead
        setMessages([]);
      }
    } else if (availableDocuments.length > 0 && !docId) {
      // If no docId but docs exist, prompt user to select one
      setCurrentDocument(null);
      setMessages([]);
    } else if (availableDocuments.length === 0) {
      setCurrentDocument(null);
      setMessages([
        {
          id: 1,
          role: "assistant",
          content: "Welcome to your Legal AI Advisor. Please upload a document first to begin analysis.",
        },
      ]);
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
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-foreground">Access Denied</h2>
        <p className="mt-2 text-muted-foreground">Please log in to use the chat advisor.</p>
        <Link href="/login" className="mt-4 inline-block text-primary hover:text-primary/80">
          Go to Login
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-100px)] max-h-[900px] rounded-lg overflow-hidden border border-border">
      {/* Document Sidebar */}
      <div className="w-64 bg-card border-r border-border p-4 flex flex-col">
        <h2 className="text-xl font-bold text-foreground mb-4 flex items-center">
          <FileText className="w-5 h-5 mr-2 text-primary" />
          Documents
        </h2>
        <div className="flex-1 overflow-y-auto space-y-2">
          {availableDocuments.length === 0 ? (
            <div className="text-center p-4 text-sm text-muted-foreground bg-secondary rounded-lg">
              No completed documents. <Link href="/documents" className="text-primary hover:underline">Upload one?</Link>
            </div>
          ) : (
            availableDocuments.map((doc) => (
              <Link
                key={doc.id}
                href={`/chat?docId=${doc.id}`}
                className={`block p-3 rounded-lg transition-colors duration-150 border ${
                  currentDocument?.id === doc.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary text-foreground hover:bg-secondary/80 border-border"
                }`}
              >
                <p className="text-sm font-medium truncate">{doc.filename}</p>
              </Link>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-background">
        {/* Legal Disclaimer - Persistent */}
        <div className="bg-amber-950/30 border-b-2 border-amber-800/50 p-3 flex items-start">
          <AlertTriangle className="w-5 h-5 text-amber-500 mr-2 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-200 leading-relaxed">
            <strong>Legal Disclaimer:</strong> This AI advisor provides informational assistance only and does not constitute legal advice, 
            create an attorney-client relationship, or serve as a substitute for professional legal counsel. Always consult with a qualified 
            attorney for legal matters. The AI may make errors or omissions. Use at your own risk.
          </p>
        </div>

        {/* Chat Header */}
        <div className="p-4 border-b border-border bg-card/50 backdrop-blur-sm">
          {currentDocument ? (
            <div className="flex items-center space-x-3">
              <FileText className="w-5 h-5 text-primary" />
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  Analyzing: <span className="text-primary font-bold">{currentDocument.filename}</span>
                </h3>
                <p className="text-sm text-muted-foreground mt-1">Ask questions about this document below</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center space-x-3">
              <FileText className="w-5 h-5 text-muted-foreground" />
              <h3 className="text-lg font-semibold text-muted-foreground">Select a Document to Begin</h3>
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4">
          {messages.length === 0 && currentDocument && (
            <div className="max-w-3xl mx-auto">
              <div className="bg-card border border-border rounded-lg p-6 mb-6">
                <div className="flex items-center mb-4">
                  <Sparkles className="w-5 h-5 text-primary mr-2" />
                  <h4 className="text-lg font-semibold text-foreground">Suggested Questions</h4>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Get started by asking one of these questions about <strong className="text-foreground">{currentDocument.filename}</strong>:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {SUGGESTED_PROMPTS.map((prompt, index) => (
                    <button
                      key={index}
                      onClick={() => setInput(prompt)}
                      className="text-left p-3 bg-secondary border border-border rounded-lg hover:bg-secondary/80 hover:border-primary/50 transition-colors text-sm text-foreground"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          {isSending && (
            <div className="flex justify-start">
              <div className="flex items-center p-3 rounded-lg bg-card text-foreground rounded-tl-none border border-border">
                <Loader2 className="w-4 h-4 mr-2 animate-spin text-primary" />
                <p className="text-sm">AI is thinking...</p>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <div className="p-4 border-t border-border bg-card/50 backdrop-blur-sm">
          <form onSubmit={handleSend} className="flex space-x-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={currentDocument ? "Ask a question about the document..." : "Please select a document first."}
              disabled={isSending || !currentDocument}
              className="flex-1 p-3 bg-input border border-border rounded-lg text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary focus:border-primary transition-colors disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isSending || !input.trim() || !currentDocument}
              className="p-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

