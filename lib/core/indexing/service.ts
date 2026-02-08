import { prisma } from "@/lib/infrastructure/database/prisma";
import { embeddings, generateEmbedding } from "@/lib/infrastructure/ai/embedding";
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

    // 1. Delete existing chunks first (idempotency)
    await prisma.articleChunk.deleteMany({
      where: { articleId }
    });

    // 2. Process chunks in batches
    const BATCH_SIZE = 20;

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);

      try {
        const sanitizedBatch = batch.map(t => t.replace(/\n/g, ' '));
        const vectors = await embeddings.embedDocuments(sanitizedBatch);

        await Promise.all(batch.map(async (chunkContent, idx) => {
          const embedding = vectors[idx];
          const chunkId = randomUUID();

          try {
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

    // 3. Update Article Metadata & Embedding (Fix for Imported Content)
    try {
      const totalBlocks = chunks.length;
      // Estimate: 400 chars per minute for reading speed
      const totalReadingTime = Math.ceil(content.length / 400);

      // Update stats
      await prisma.article.update({
        where: { id: articleId },
        data: {
          totalBlocks: totalBlocks,
          totalReadingTime: totalReadingTime,
          // Only update type if it was missing? No, keep existing.
        }
      });

      // Update Article-level Embedding (Title + first 500 chars)
      const title = article.title || 'Untitled';
      const domain = article.domain || '';
      const snippet = content.slice(0, 500).replace(/\n/g, ' ');
      const textToEmbed = `Title: ${title}\nDomain: ${domain}\nContent: ${snippet}`;

      const articleEmbedding = await generateEmbedding(textToEmbed);

      await prisma.$executeRaw`
        UPDATE articles 
        SET 
          embedding = ${JSON.stringify(articleEmbedding)}::vector(1536),
          "searchVector" = to_tsvector('simple', ${title} || ' ' || ${content})
        WHERE id = ${articleId}::uuid
      `;

      console.log(`[Indexing] Article ${articleId}: Metadata & Embeddings updated`);

    } catch (e) {
      console.error(`[Indexing] Failed to update article metadata/embedding for ${articleId}`, e);
    }

    console.log(`[Indexing] Article ${articleId}: Indexing complete`);
  }
}
