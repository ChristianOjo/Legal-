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
 * Helper function to add timeout to fetch requests
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = 30000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}

/**
 * Generate embeddings for text chunks using Cohere with retry logic
 */
export async function generateEmbeddings(
  texts: string[],
  retries: number = 3
): Promise<number[][]> {
  if (!COHERE_API_KEY) {
    throw new Error("COHERE_API_KEY is not configured");
  }

  if (texts.length === 0) {
    return [];
  }

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetchWithTimeout(
        COHERE_API_URL,
        {
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
        },
        30000 // 30 second timeout
      );

      if (!response.ok) {
        const errorText = await response.text();
        // Don't retry on 4xx errors (client errors)
        if (response.status >= 400 && response.status < 500) {
          throw new Error(`Cohere API error: ${response.status} - ${errorText}`);
        }
        // Retry on 5xx errors (server errors)
        throw new Error(`Cohere API error: ${response.status} - ${errorText}`);
      }

      const data: EmbeddingResponse = await response.json();
      if (!data.embeddings || data.embeddings.length !== texts.length) {
        throw new Error("Invalid response from Cohere API");
      }
      return data.embeddings;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Don't retry on certain errors
      if (lastError.message.includes("timeout") && attempt < retries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff, max 5s
        console.warn(`Embedding generation attempt ${attempt} failed, retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      
      if (attempt === retries) {
        console.error(`Error generating embeddings after ${retries} attempts:`, lastError);
        throw lastError;
      }
      
      // Wait before retry
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error("Failed to generate embeddings");
}

/**
 * Generate embedding for a single query
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  if (!COHERE_API_KEY) {
    throw new Error("COHERE_API_KEY is not configured");
  }

  if (!query || query.trim().length === 0) {
    throw new Error("Query cannot be empty");
  }

  try {
    const response = await fetchWithTimeout(
      COHERE_API_URL,
      {
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
      },
      15000 // 15 second timeout for queries
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Cohere API error: ${response.status} - ${error}`);
    }

    const data: EmbeddingResponse = await response.json();
    if (!data.embeddings || data.embeddings.length === 0) {
      throw new Error("Invalid response from Cohere API");
    }
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
  batchSize: number = 96, // Cohere free tier limit
  onProgress?: (current: number, total: number) => void
): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const embeddings: number[][] = [];
  const totalBatches = Math.ceil(texts.length / batchSize);

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    
    try {
      const batchEmbeddings = await generateEmbeddings(batch);
      embeddings.push(...batchEmbeddings);
      
      // Report progress
      if (onProgress) {
        onProgress(batchNumber, totalBatches);
      }

      // Add delay to respect rate limits (only if not last batch)
      if (i + batchSize < texts.length) {
        await new Promise((resolve) => setTimeout(resolve, 500)); // Reduced from 1000ms
      }
    } catch (error) {
      console.error(`Failed to generate embeddings for batch ${batchNumber}/${totalBatches}:`, error);
      throw error;
    }
  }

  return embeddings;
}