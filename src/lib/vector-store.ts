import { Pinecone } from "@pinecone-database/pinecone";
import { v4 as uuidv4 } from "uuid";

// Initialize Pinecone client
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

const indexName = process.env.PINECONE_INDEX_NAME || "legal-documents";

export interface VectorMetadata {
  documentId: string;
  userId: string;
  chunkIndex: number;
  content: string;
  filename: string;
  fileType: string;
  timestamp: string;
}

export interface ScoredVector {
  id: string;
  score: number;
  metadata: VectorMetadata;
}

/**
 * Get or create Pinecone index
 */
export async function getOrCreateIndex() {
  try {
    const indexes = await pinecone.listIndexes();
    const indexExists = indexes.indexes?.some((idx) => idx.name === indexName);

    if (!indexExists) {
      await pinecone.createIndex({
        name: indexName,
        dimension: 1024, // Cohere embed-english-v3.0 dimension
        metric: "cosine",
        spec: {
          serverless: {
            cloud: "aws",
            region: "us-east-1",
          },
        },
      });

      // Wait for index to be ready
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }

    return pinecone.index(indexName);
  } catch (error) {
    console.error("Error getting/creating Pinecone index:", error);
    throw error;
  }
}

/**
 * Upsert vectors to Pinecone
 */
export async function upsertVectors(
  embeddings: number[][],
  chunks: Array<{
    content: string;
    metadata: {
      chunkIndex: number;
      filename: string;
    };
  }>,
  documentId: string,
  userId: string,
  fileType: string
): Promise<string[]> {
  try {
    const index = await getOrCreateIndex();
    const vectorIds: string[] = [];

    // Prepare vectors for upsert
    const vectors = embeddings.map((embedding, i) => {
      const vectorId = uuidv4();
      vectorIds.push(vectorId);

      return {
        id: vectorId,
        values: embedding,
        metadata: {
          documentId,
          userId,
          chunkIndex: chunks[i].metadata.chunkIndex,
          content: chunks[i].content,
          filename: chunks[i].metadata.filename,
          fileType,
          timestamp: new Date().toISOString(),
        },
      };
    });

    // Upsert in batches of 100 with retry logic
    const batchSize = 100;
    const totalBatches = Math.ceil(vectors.length / batchSize);
    
    for (let i = 0; i < vectors.length; i += batchSize) {
      const batch = vectors.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      let retries = 3;
      let success = false;

      while (retries > 0 && !success) {
        try {
          await Promise.race([
            index.upsert(batch),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Pinecone upsert timeout")), 30000)
            ),
          ]);
          success = true;
        } catch (error) {
          retries--;
          if (retries === 0) {
            console.error(`Failed to upsert batch ${batchNumber}/${totalBatches} after retries:`, error);
            throw new Error(`Pinecone upsert failed: ${error instanceof Error ? error.message : "Unknown error"}`);
          }
          // Wait before retry
          await new Promise((resolve) => setTimeout(resolve, 1000 * (4 - retries)));
        }
      }
    }

    return vectorIds;
  } catch (error) {
    console.error("Error upserting vectors:", error);
    throw error;
  }
}

/**
 * Query vectors from Pinecone
 */
export async function queryVectors(
  queryEmbedding: number[],
  userId: string,
  options: {
    topK?: number;
    minScore?: number;
    documentIds?: string[];
  } = {}
): Promise<ScoredVector[]> {
  try {
    const { topK = 5, minScore = 0.7, documentIds } = options;
    const index = await getOrCreateIndex();

    // Build filter
    const filter: any = { userId: { $eq: userId } };
    if (documentIds && documentIds.length > 0) {
      filter.documentId = { $in: documentIds };
    }

    // Query vectors
    const queryResponse = await index.query({
      vector: queryEmbedding,
      topK,
      includeMetadata: true,
      filter,
    });

    // Filter by minimum score and return results
    return (
      queryResponse.matches
        ?.filter((match) => match.score && match.score >= minScore)
        .map((match) => ({
          id: match.id,
          score: match.score || 0,
          metadata: (() => {
  const md = match.metadata || {};
  return {
    documentId: String(md.documentId || ''),
    userId: String(md.userId || ''),
    chunkIndex: Number(md.chunkIndex || 0),
    content: String(md.content || ''),
    filename: String(md.filename || ''),
    fileType: String(md.fileType || ''),
    timestamp: String(md.timestamp || new Date().toISOString()),
  };
})(),


        })) || []
    );
  } catch (error) {
    console.error("Error querying vectors:", error);
    throw error;
  }
}

/**
 * Delete vectors for a document
 */
export async function deleteDocumentVectors(
  documentId: string,
  userId: string
): Promise<void> {
  try {
    const index = await getOrCreateIndex();

    // Delete all vectors for this document
    await index.deleteMany({
      documentId: { $eq: documentId },
      userId: { $eq: userId },
    });
  } catch (error) {
    console.error("Error deleting document vectors:", error);
    throw error;
  }
}

/**
 * Delete all vectors for a user
 */
export async function deleteUserVectors(userId: string): Promise<void> {
  try {
    const index = await getOrCreateIndex();

    await index.deleteMany({
      userId: { $eq: userId },
    });
  } catch (error) {
    console.error("Error deleting user vectors:", error);
    throw error;
  }
}

/**
 * Get vector count for a user
 */
export async function getUserVectorCount(userId: string): Promise<number> {
  try {
    const index = await getOrCreateIndex();
    
    const stats = await index.describeIndexStats();
    
    // Note: Pinecone doesn't provide exact count by filter in free tier
    // This returns total count - implement proper tracking in your DB
    return stats.totalRecordCount || 0;
  } catch (error) {
    console.error("Error getting vector count:", error);
    return 0;
  }
}