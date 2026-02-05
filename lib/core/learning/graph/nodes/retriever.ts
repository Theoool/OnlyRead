import { prisma } from '@/lib/infrastructure/database/prisma';
import { generateEmbedding } from '@/lib/infrastructure/ai/embedding';
import { Prisma } from '@/lib/generated/prisma';

function isUuid(value: unknown): value is string {
  if (typeof value !== 'string') return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim(),
  )
}

function uuidArray(ids: string[]): Prisma.Sql {
  return Prisma.sql`ARRAY[${Prisma.join(ids)}]::uuid[]`
}

export const retrieverNode = async (state: any) => {
  console.log("========== 开始检索 ==========");
  console.log(`[Retriever] UserId: ${state.userId}`);
  console.log(`[Retriever] Query: ${state.userMessage}`);
  console.log(`[Retriever] ArticleIds: ${JSON.stringify(state.articleIds)}`);
  console.log(`[Retriever] CollectionId: ${state.collectionId}`);
  
  const query = state.userMessage;
  const userId = state.userId;
  const rawArticleIds: unknown[] = Array.isArray(state.articleIds) ? state.articleIds : [];
  const sanitizedArticleIds: string[] = Array.from(
    new Set(
      rawArticleIds
        .map((v) => (typeof v === 'string' ? v.trim() : ''))
        .filter((v: string) => v.length > 0 && isUuid(v)),
    ),
  );
  const sanitizedCollectionId = isUuid(state.collectionId) ? state.collectionId : undefined;
  const articleIds = sanitizedArticleIds.length > 0 ? sanitizedArticleIds : undefined
  const collectionId = articleIds ? undefined : sanitizedCollectionId
  console.log("检索条件",state);
  
  if (!userId) {
    console.warn("Retriever: No userId provided, skipping retrieval.");
    return { documents: "", sources: [] };
  }

  // === SPECIAL HANDLING FOR 'PLAN' ===
  // If the supervisor decided we need a plan, we fetch Article Summaries instead of chunks.
  if (state.nextStep === 'plan' && ((articleIds && articleIds.length > 0) || collectionId)) {
    console.log(`[Retriever] Fetching summaries for PLANNING. ArticleIds: ${articleIds?.length}, CollectionId: ${collectionId}`);
    try {
      let articles:any;
      if (collectionId) {
          articles = await prisma.article.findMany({
              where: {
                  collectionId: collectionId,
                  userId: userId,
                  deletedAt: null,
              },
              select: {
                  id: true,
                  title: true,
                  summary: true,
                  domain: true,
              }
          });
      } else if (articleIds && articleIds.length > 0) {
          articles = await prisma.article.findMany({
            where: {
              id: { in: articleIds },
              userId: userId,
              deletedAt: null,
            },
            select: {
              id: true,
              title: true,
              summary: true,
              domain: true,
            }
          });
      } else {
          articles = [];
      }

      const sources = articles.map((a: any) => ({
        articleId: a.id,
        title: a.title || '(untitled)',
        domain: a.domain || null,
        content: a.summary || "No summary available.",
        excerpt: a.summary ? (a.summary.slice(0, 200) + '...') : "No summary.",
        similarity: 1.0 // Implicit high relevance
      }));

      const contextText = sources.map((s: any, idx: number) => 
        `【Article ${idx + 1}】Title: ${s.title}\nSummary: ${s.content}`
      ).join('\n\n');

      return {
        documents: contextText,
        sources: sources.map((s: any) => ({
          articleId: s.articleId,
          title: s.title,
          excerpt: s.excerpt,
          similarity: s.similarity,
          domain: s.domain
        }))
      };
    } catch (e) {
      console.error("[Retriever] Failed to fetch article summaries:", e);
      // Fallthrough to vector search if this fails
    }
  }

  let queryVector: number[] = [];
  try {
    queryVector = await generateEmbedding(query);
    console.log(`[Retriever] Generated embedding vector (length: ${queryVector.length})`);
  } catch (e) {
    console.error("Retriever: Embedding failed", e);
    return { documents: "", sources: [] };
  }

  let filterClause = Prisma.sql``;
  
  if (articleIds && articleIds.length > 0) {
    // Create a UUID array for Postgres
    console.log(`[Retriever] Filtering by articleIds: ${articleIds.length} articles`);
    filterClause = Prisma.sql`AND c.article_id = ANY(ARRAY[${Prisma.join(articleIds)}]::uuid[])`;
  } else if (collectionId) {
    console.log(`[Retriever] Filtering by collectionId: ${collectionId}`);
    // Use JOIN to filter by collectionId from articles table
    // Fix: Pass collectionId as a string parameter, do not cast ::uuid inside the template literal for string values if Prisma handles it,
    // BUT for raw query, we need to be careful.
    // The previous error `syntax error at or near "$3"` suggests Prisma might be messing up the parameter index or casting.
    // Let's try explicit casting with Prisma.sql and ensure the value is passed correctly.
    // Reverting to simpler syntax which worked for userId
    filterClause = Prisma.sql`AND a.collection_id = ${collectionId}::uuid`;
  } else {
    console.warn(`[Retriever] No articleIds or collectionId provided. Will search all user documents.`);
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

    console.log(`[Retriever] Found ${retrieved.length} chunks. Top similarity: ${retrieved[0]?.similarity || 'N/A'}`);

    const sources = retrieved.map((r) => ({
        articleId: r.articleId,
        title: r.title || '(untitled)',
        domain: r.domain || null,
        // Use full content for the AI context, but truncate for the UI source chip if needed
        // For the AI prompt context, we use the full chunk content.
        content: r.content,
        excerpt: r.content.length > 200 ? r.content.slice(0, 200) + '...' : r.content,
        similarity: Math.round(r.similarity * 100) / 100,
    }));

    const contextText =
        sources.length === 0
        ? ''
        : sources
            .map(
                (s, idx) =>
                `【Source ${idx + 1}】Title: ${s.title}\nContent:\n${s.content}`
            )
            .join('\n\n');

    console.log(`[Retriever] Returning ${sources.length} sources, context length: ${contextText.length} chars`);
    console.log(`[Retriever] Source titles: ${sources.map(s => s.title).join(', ')}`);

    return {
        documents: contextText,
        // UI gets the truncated excerpt
        sources: sources.map(s => ({ 
          articleId: s.articleId,
          title: s.title,
          excerpt: s.excerpt,
          similarity: s.similarity,
          domain: s.domain
        })),
    };

  } catch (error) {
      console.error("Retriever SQL Error:", error);
      return { documents: "", sources: [] };
  }
};
