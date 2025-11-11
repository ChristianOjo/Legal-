import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GroqResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface Source {
  documentId: string;
  filename: string;
  content: string;
  score: number;
  chunkIndex: number;
}

/**
 * System prompt for legal advisor - ensures no hallucinations
 */
const SYSTEM_PROMPT = `You are a legal information assistant that provides accurate information based ONLY on the provided legal documents and case files.

CRITICAL RULES:
1. NEVER make up or invent information not present in the provided context
2. ALWAYS cite the specific document and section when making claims
3. If information is not available in the provided documents, explicitly state: "I don't have information about this in the provided documents"
4. When analyzing cases, only reference cases that appear in the context
5. Be precise and accurate - legal information requires exactness
6. If asked about something not covered in the documents, acknowledge this limitation
7. Never provide specific legal advice - only provide information based on the documents
8. Always include a disclaimer that this is informational only and not legal advice

FORMAT YOUR RESPONSES:
- Use clear, professional language
- Include inline citations like [Source: filename.pdf, Section X]
- Structure answers with clear reasoning
- Acknowledge uncertainty when appropriate

Remember: Accuracy and truthfulness are paramount. It's better to say "I don't know" than to provide incorrect information.`;

/**
 * Generate a response using Groq with retrieved context
 */
export async function generateResponse(
  query: string,
  sources: Source[],
  conversationHistory: ChatMessage[] = []
): Promise<GroqResponse> {
  try {
    // Build context from sources
    const context = buildContext(sources);

    // Build messages
    const messages: ChatMessage[] = [
      {
        role: "system",
        content: SYSTEM_PROMPT,
      },
      ...conversationHistory.slice(-6), // Keep last 3 turns for context
      {
        role: "user",
        content: buildUserPrompt(query, context),
      },
    ];

    // Call Groq API
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-70b-versatile", // Free tier model
      messages: messages as any,
      temperature: 0.1, // Low temperature for factual responses
      max_tokens: 2000,
      top_p: 0.9,
    });

    const response = completion.choices[0]?.message?.content || "";

    return {
      content: response,
      usage: {
        promptTokens: completion.usage?.prompt_tokens || 0,
        completionTokens: completion.usage?.completion_tokens || 0,
        totalTokens: completion.usage?.total_tokens || 0,
      },
    };
  } catch (error) {
    console.error("Error generating response:", error);
    throw new Error("Failed to generate response from LLM");
  }
}

/**
 * Build context string from retrieved sources
 */
function buildContext(sources: Source[]): string {
  if (sources.length === 0) {
    return "No relevant documents found.";
  }

  let context = "RELEVANT LEGAL DOCUMENTS:\n\n";

  sources.forEach((source, index) => {
    context += `[Document ${index + 1}: ${source.filename}]\n`;
    context += `Relevance Score: ${(source.score * 100).toFixed(1)}%\n`;
    context += `Content:\n${source.content}\n\n`;
    context += "---\n\n";
  });

  return context;
}

/**
 * Build user prompt with query and context
 */
function buildUserPrompt(query: string, context: string): string {
  return `${context}

QUESTION: ${query}

INSTRUCTIONS:
1. Answer the question using ONLY the information from the documents above
2. Cite your sources by referring to the document names
3. If the documents don't contain enough information to answer fully, say so
4. Be precise and quote relevant sections when appropriate
5. Include this disclaimer: "This is informational only and not legal advice. Consult a qualified attorney for advice specific to your situation."

ANSWER:`;
}

/**
 * Generate a streaming response (for real-time UI updates)
 */
export async function* generateStreamingResponse(
  query: string,
  sources: Source[],
  conversationHistory: ChatMessage[] = []
): AsyncGenerator<string, void, unknown> {
  try {
    const context = buildContext(sources);

    const messages: ChatMessage[] = [
      {
        role: "system",
        content: SYSTEM_PROMPT,
      },
      ...conversationHistory.slice(-6),
      {
        role: "user",
        content: buildUserPrompt(query, context),
      },
    ];

    const stream = await groq.chat.completions.create({
      model: "llama-3.1-70b-versatile",
      messages: messages as any,
      temperature: 0.1,
      max_tokens: 2000,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        yield content;
      }
    }
  } catch (error) {
    console.error("Error generating streaming response:", error);
    throw new Error("Failed to generate streaming response");
  }
}

/**
 * Analyze query to determine if it can be answered with available context
 */
export async function analyzeQuery(
  query: string,
  sources: Source[]
): Promise<{
  canAnswer: boolean;
  confidence: number;
  reasoning: string;
}> {
  try {
    if (sources.length === 0) {
      return {
        canAnswer: false,
        confidence: 0,
        reasoning: "No relevant documents found",
      };
    }

    // Calculate average relevance score
    const avgScore =
      sources.reduce((sum, s) => sum + s.score, 0) / sources.length;

    const canAnswer = avgScore >= 0.7 && sources.length >= 2;
    const confidence = Math.min(avgScore * 100, 95); // Cap at 95%

    return {
      canAnswer,
      confidence,
      reasoning: canAnswer
        ? `Found ${sources.length} relevant document(s) with average relevance of ${(avgScore * 100).toFixed(1)}%`
        : "Retrieved documents may not contain sufficient information to answer this query accurately",
    };
  } catch (error) {
    console.error("Error analyzing query:", error);
    return {
      canAnswer: false,
      confidence: 0,
      reasoning: "Error analyzing query",
    };
  }
}