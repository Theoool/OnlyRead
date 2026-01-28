import { prisma } from '@/lib/infrastructure/database/prisma';
import { generateEmbedding } from '@/lib/infrastructure/ai/embedding';
import { Prisma } from '@/lib/generated/prisma';

export const retrieverNode = async (state: any) => {
  const query = state.userMessage;
  const userId = state.userId;
  const articleIds = state.articleIds as string[] | undefined; // Array of UUIDs
  const collectionId = state.collectionId as string | undefined;

  if (!userId) {
    console.warn("Retriever: No userId provided, skipping retrieval.");
    return { documents: "" };
  }

  let queryVector: number[] = [];
  try {
    queryVector = await generateEmbedding(query);
  } catch (e) {
    console.error("Retriever: Embedding failed", e);
    return { documents: "" };
  }

  // Build dynamic SQL parts safely
  // Note: Prisma $queryRaw doesn't support array parameters directly in all cases nicely for IN clause with raw SQL + UUIDs
  // But we can use Prisma.sql to compose it if we want, or just handle logic in application layer if list is small.
  // For safety and simplicity with pgvector, we use raw query.
  
  // We need to filter by articleIds OR collectionId if present.
  
  let filterClause = Prisma.sql``;
  
  if (articleIds && articleIds.length > 0) {
      // Create a UUID array for Postgres
      filterClause = Prisma.sql`AND c.article_id = ANY(${articleIds}::uuid[])`;
  } else if (collectionId) {
      filterClause = Prisma.sql`AND a.collection_id = ${collectionId}::uuid`;
  }

  try {
    const retrieved = await prisma.$queryRaw<
        Array<{
        id: string
        content: string
        articleId: string
        title: string | null
        domain: string | null
        similarity: number
        }>
    >`
        SELECT
        c.id,
        c.content,
        a.id as "articleId",
        a.title,
        a.domain,
        1 - (c.embedding <=> ${JSON.stringify(queryVector)}::vector(1536)) as similarity
        FROM article_chunks c
        JOIN articles a ON c.article_id = a.id
        WHERE c.user_id = ${userId}::uuid
        AND a.deleted_at IS NULL
        ${filterClause}
        ORDER BY similarity DESC
        LIMIT 5;
    `;

    const sources = retrieved.map((r) => ({
        title: r.title || '(untitled)',
        excerpt: r.content,
    }));

    const contextText =
        sources.length === 0
        ? ''
        : sources
            .map(
                (s, idx) =>
                `【Source ${idx + 1}】Title: ${s.title}\nContent:\n${s.excerpt}`
            )
            .join('\n\n');

    return {
        documents: contextText
    };

  } catch (error) {
      console.error("Retriever SQL Error:", error);
      return { documents: "" };
  }
};
