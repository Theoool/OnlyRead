import { prisma } from "@/lib/infrastructure/database/prisma";
import { embeddings } from "@/lib/infrastructure/ai/embedding";
import { chunkText } from "@/lib/text-processing";
import { randomUUID } from "crypto";

export class IndexingService {
  /**
   * Process an article: Chunk it, generate embeddings, and save to DB
   */
  static async processArticle(articleId: string, userId: string) {
    const article = await prisma.article.findUnique({
      where: { id: articleId },
      include: { body: true }
    });

    if (!article || !article.body || !article.body.content) {
      console.warn(`[Indexing] Article ${articleId} not found or empty`);
      return;
    }

    const content = article.body.content;
    const chunks = chunkText(content);

    console.log(`[Indexing] Article ${articleId}: Generated ${chunks.length} chunks`);

    // Delete existing chunks first (idempotency)
    await prisma.articleChunk.deleteMany({
      where: { articleId }
    });

    // Process in batches to avoid rate limits and optimize network
    // Increased batch size because embedDocuments handles batching efficiently
    const BATCH_SIZE = 20; 
    
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      
      try {
        // Sanitize text as per original logic (replace newlines)
        const sanitizedBatch = batch.map(t => t.replace(/\n/g, ' '));
        
        // Generate embeddings for the whole batch in one go
        const vectors = await embeddings.embedDocuments(sanitizedBatch);

        // Insert chunks in parallel
        await Promise.all(batch.map(async (chunkContent, idx) => {
          const embedding = vectors[idx];
          const chunkId = randomUUID();
          
          try {
            // Insert chunk using raw query to handle vector type
            await prisma.$executeRaw`
              INSERT INTO "article_chunks" (
                "id", "user_id", "article_id", "order", "content", "embedding", "created_at"
              ) VALUES (
                ${chunkId}::uuid,
                ${userId}::uuid,
                ${articleId}::uuid,
                ${i + idx},
                ${chunkContent},
                ${JSON.stringify(embedding)}::vector,
                NOW()
              )
            `;
          } catch (insertError) {
             console.error(`[Indexing] Failed to insert chunk ${i + idx} for article ${articleId}`, insertError);
          }
        }));
      } catch (e) {
        console.error(`[Indexing] Failed to generate embeddings for batch starting at ${i} for article ${articleId}`, e);
      }
    }
    
    console.log(`[Indexing] Article ${articleId}: Indexing complete`);
  }
}
