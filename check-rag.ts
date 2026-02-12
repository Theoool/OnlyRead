require('dotenv').config();
import { prisma } from './lib/infrastructure/database/prisma';
import { generateEmbedding } from './lib/infrastructure/ai/embedding';
import { IndexingService } from './lib/core/indexing/service';

async function main() {
  console.log("Checking RAG status...");

  const user = { id: '3cce39d0-942b-4ba2-9005-60f72b8aa042' }
  if (!user) {
    console.log("No user found in DB.");
    return;
  }
  console.log("Found user:", user.id);

  // 1. Check Articles
  const articles = await prisma.article.findMany({ where: { userId: user.id } });
  console.log(`Found ${articles.length} articles.`);

  if (articles.length === 0) {
    console.log("No articles to index.");
    return;
  }

  // 2. Check Chunks
  const chunksCount = await prisma.articleChunk.count({ where: { userId: user.id } });
  console.log(`Found ${chunksCount} chunks.`);

  // 3. If chunks exist, check embedding
  if (chunksCount > 0) {
    // Check if embeddings are actually present (not null)
    const embeddingStats: any[] = await prisma.$queryRaw`
        SELECT 
            count(*) as total,
            count(embedding) as with_embedding,
            vector_dims(embedding) as dims
        FROM article_chunks
        WHERE user_id = ${user.id}::uuid
        GROUP BY vector_dims(embedding)
      `;
    console.log("Embedding Stats:", embeddingStats);

    // 4. Test Retrieval
    console.log("Testing retrieval with query 'test'...");
    try {
      const queryVector = await generateEmbedding("test");
      console.log("Generated query vector length:", queryVector.length);

      const results = await prisma.$executeRawUnsafe(`
            SELECT id, content, 1 - (embedding <=> '[${queryVector.join(',')}]'::vector) as similarity
            FROM article_chunks
            WHERE user_id = '${user.id}'
            ORDER BY similarity DESC
            LIMIT 3
          `);
      // Note: using queryRawUnsafe for quick check script simplicity, avoiding json serialization issues
      const results2 = await prisma.$queryRaw`
             SELECT id, content, 1 - (embedding <=> ${JSON.stringify(queryVector)}::vector) as similarity
             FROM article_chunks
             WHERE user_id = ${user.id}::uuid
             ORDER BY similarity DESC
             LIMIT 3
          `;
      console.log("Retrieval results:", results2);
    } catch (e) {
      console.error("Retrieval failed:", e);
    }
  } else {
    console.log("No chunks found. Attempting to index the first article...");
    const article = articles[0];
    await IndexingService.processArticle(article.id, user.id, user);
    console.log("Indexing triggered. Please re-run check.");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
