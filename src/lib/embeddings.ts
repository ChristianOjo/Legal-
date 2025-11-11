/**
 * Embeddings service using Cohere API (free tier)
 * Alternative: Can use Together.ai or other providers
 */

interface EmbeddingResponse {
  embeddings: number[][];
  meta?: {
    api_version?: { version: string };
  };
}

const COHERE_API_URL = "https://api.cohere.ai/v1/embed";
const COHERE_API_KEY = process.env.COHERE_API_KEY;

/**
 * Generate embeddings for text chunks using Cohere
 */
export async function generateEmbeddings(
  texts: string[]
): Promise<number[][]> {
  if (!COHERE_API_KEY) {
    throw new Error("COHERE_API_KEY is not configured");
  }

  try {
    const response = await fetch(COHERE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${COHERE_API_KEY}`,
      },
      body: JSON.stringify({
        texts,
        model: "embed-english-v3.0", // 1024 dimensions, free tier
        input_type: "search_document", // For indexing documents
        truncate: "END",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Cohere API error: ${response.status} - ${error}`);
    }

    const data: EmbeddingResponse = await response.json();
    return data.embeddings;
  } catch (error) {
    console.error("Error generating embeddings:", error);
    throw error;
  }
}

/**
 * Generate embedding for a single query
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  if (!COHERE_API_KEY) {
    throw new Error("COHERE_API_KEY is not configured");
  }

  try {
    const response = await fetch(COHERE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${COHERE_API_KEY}`,
      },
      body: JSON.stringify({
        texts: [query],
        model: "embed-english-v3.0",
        input_type: "search_query", // For search queries
        truncate: "END",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Cohere API error: ${response.status} - ${error}`);
    }

    const data: EmbeddingResponse = await response.json();
    return data.embeddings[0];
  } catch (error) {
    console.error("Error generating query embedding:", error);
    throw error;
  }
}

/**
 * Generate embeddings in batches to avoid rate limits
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  batchSize: number = 96 // Cohere free tier limit
): Promise<number[][]> {
  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchEmbeddings = await generateEmbeddings(batch);
    embeddings.push(...batchEmbeddings);

    // Add delay to respect rate limits
    if (i + batchSize < texts.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return embeddings;
}