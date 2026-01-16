import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL
});


export async function generateEmbedding(text: string): Promise<number[]> {
  // Preprocess text: remove newlines to improve performance as recommended by OpenAI
  const sanitizedText = text.replace(/\n/g, ' ');
  const model = process.env.TEXT_MODEL_NAME || 'text-embedding-v3';

  try {
    // Note: Alibaba Cloud Qwen (DashScope) text-embedding-v3 returns 1024 dimensions.
    // text-embedding-v2 returns 1536 dimensions.
    // If your database vector column is fixed to 1536, you might need to use v2 or update the schema.
    // We removed 'dimensions' parameter because it can cause "Model does not exist" errors on some non-OpenAI providers if unsupported.
    const response = await openai.embeddings.create({
      model: model,
      input: sanitizedText,
      encoding_format: 'float',
    });
    
    // console.log("Generated embedding:", response);
    
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    // Enhance error message for better debugging
    if (error instanceof OpenAI.APIError) {
       console.error(`OpenAI API Error: ${error.status} - ${error.code} - ${error.type}`);
    }
    throw new Error('Failed to generate embedding');
  }
}

/**
 * Calculate cosine similarity between two vectors
 * Useful for client-side comparison if needed, though DB is preferred for search
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vectors must have the same length. A: ${a.length}, B: ${b.length}`);
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
