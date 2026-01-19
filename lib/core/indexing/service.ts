import { prisma } from "@/lib/infrastructure/database/prisma";
import { generateEmbedding } from "@/lib/infrastructure/ai/embedding";
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

    // Process in batches to avoid rate limits
    const BATCH_SIZE = 5;
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      
      await Promise.all(batch.map(async (chunkContent, idx) => {
        try {
          const embedding = await generateEmbedding(chunkContent);
          const chunkId = randomUUID();
          
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
        } catch (e) {
          console.error(`[Indexing] Failed to embed chunk ${i + idx} for article ${articleId}`, e);
        }
      }));
    }
    
    console.log(`[Indexing] Article ${articleId}: Indexing complete`);
  }
}
