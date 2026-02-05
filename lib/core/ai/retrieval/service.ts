import { prisma } from '@/lib/infrastructure/database/prisma';
import { generateEmbedding } from '@/lib/infrastructure/ai/embedding';
import { Prisma } from '@/lib/generated/prisma';
import { RetrievalOptions, RetrievalResult, SearchResult } from './types';

type RetrievalRow = {
  id: string
  content: string
  articleId: string
  title: string | null
  domain: string | null
  similarity: number
}

export class RetrievalService {
  private static uuidArray(ids: string[]): Prisma.Sql {
    return Prisma.sql`ARRAY[${Prisma.join(ids)}]::uuid[]`
  }
 
  static async search(options: RetrievalOptions): Promise<RetrievalResult> {
    const { query, userId, filter, mode = 'fast', topK = 5 } = options;

    console.log(`[RetrievalService] Search started - mode: ${mode}, userId: ${userId}, query: "${query.substring(0, 50)}..."`);
    console.log(`[RetrievalService] Filter:`, JSON.stringify(filter));

    if (mode === 'comprehensive' && (filter?.articleIds?.length || filter?.collectionId)) {
        console.log(`[RetrievalService] Using comprehensive mode (summaries)`);
        return this.searchSummaries(userId, filter);
    }

    const vectorResult = await this.searchChunks(query, userId, filter, topK);

    if (vectorResult.sources.length === 0) {
      console.log(`[RetrievalService] No vector results, trying full-text fallback`);
      return this.searchFullText(query, userId, filter, topK);
    }

    return vectorResult;
  }

  private static async searchSummaries(userId: string, filter: RetrievalOptions['filter']): Promise<RetrievalResult> {
    console.log(`[RetrievalService] Fetching summaries for userId: ${userId}`);
    
    try {
      let articles: { id: string; title: string | null; summary: string | null; domain: string | null }[] = [];
      
      if (filter?.collectionId) {
          articles = await prisma.article.findMany({
              where: {
                  collectionId: filter.collectionId,
                  userId: userId,
                  deletedAt: null,
              },
              select: { id: true, title: true, summary: true, domain: true }
          });
      } else if (filter?.articleIds && filter.articleIds.length > 0) {
          articles = await prisma.article.findMany({
            where: {
              id: { in: filter.articleIds },
              userId: userId,
              deletedAt: null,
            },
            select: { id: true, title: true, summary: true, domain: true }
          });
      }

      const sources: SearchResult[] = articles.map(a => ({
        articleId: a.id,
        title: a.title || '(untitled)',
        domain: a.domain || null,
        content: a.summary || "No summary available.",
        excerpt: a.summary ? (a.summary.slice(0, 200) + '...') : "No summary.",
        similarity: 1.0 // Implicit high relevance
      }));

      const documents = sources.map((s, idx) => 
        `【Article ${idx + 1}】Title: ${s.title}\nSummary: ${s.content}`
      ).join('\n\n');

      return { documents, sources };
    } catch (e) {
      console.error("[RetrievalService] Failed to fetch article summaries:", e);
      return { documents: "", sources: [] };
    }
  }

   private static async searchChunks(
  query: string,
  userId: string,
  filter: RetrievalOptions['filter'],
  topK: number
): Promise<RetrievalResult> {
  const queryVector = await generateEmbedding(query);

  if (filter?.articleIds?.length) {
    const results = await prisma.$queryRaw<RetrievalRow[]>`
      SELECT c.id, c.content, a.id as "articleId", a.title, a.domain,
             1 - (c.embedding <=> ${queryVector}::vector) as similarity
      FROM article_chunks c
      JOIN articles a ON c.article_id = a.id
      WHERE c.user_id = ${userId}::uuid
        AND a.deleted_at IS NULL
        AND c.article_id = ANY(${this.uuidArray(filter.articleIds)})
      ORDER BY c.embedding <=> ${queryVector}::vector
      LIMIT ${topK};
    `;

    return this.formatResults(results);
  }

  if (filter?.collectionId) {
    const results = await prisma.$queryRaw<RetrievalRow[]>`
      SELECT c.id, c.content, a.id as "articleId", a.title, a.domain,
             1 - (c.embedding <=> ${queryVector}::vector) as similarity
      FROM article_chunks c
      JOIN articles a ON c.article_id = a.id
      WHERE c.user_id = ${userId}::uuid
        AND a.deleted_at IS NULL
        AND a.collection_id = ${filter.collectionId}::uuid
      ORDER BY c.embedding <=> ${queryVector}::vector
      LIMIT ${topK};
    `;

    return this.formatResults(results);
  }

  const results = await prisma.$queryRaw<RetrievalRow[]>`
    SELECT c.id, c.content, a.id as "articleId", a.title, a.domain,
           1 - (c.embedding <=> ${queryVector}::vector) as similarity
    FROM article_chunks c
    JOIN articles a ON c.article_id = a.id
    WHERE c.user_id = ${userId}::uuid
      AND a.deleted_at IS NULL
    ORDER BY c.embedding <=> ${queryVector}::vector
    LIMIT ${topK};
  `;

  return this.formatResults(results);
}

  private static async searchFullText(query: string, userId: string, filter: RetrievalOptions['filter'], topK: number): Promise<RetrievalResult> {
    console.log(`[RetrievalService] Full-text search for: "${query.substring(0, 50)}..."`);

    try {
      const trimmedQuery = query.trim();
      if (!trimmedQuery) {
        console.log('[RetrievalService] No valid search terms for full-text');
        return { documents: "", sources: [] };
      }

      if (filter?.articleIds?.length) {
        const retrieved = await prisma.$queryRaw<
          Array<{
            articleId: string
            title: string | null
            domain: string | null
            content: string
            rank: number
          }>
        >`
          SELECT
            a.id as "articleId",
            a.title,
            a.domain,
            b.content,
            ts_rank(
              to_tsvector('simple', b.content),
              plainto_tsquery('simple', ${trimmedQuery})
            ) as rank
          FROM articles a
          JOIN article_bodies b ON a.id = b.article_id
          WHERE a.user_id = ${userId}::uuid
            AND a.deleted_at IS NULL
            AND a.id = ANY(${this.uuidArray(filter.articleIds)})
            AND to_tsvector('simple', b.content) @@ plainto_tsquery('simple', ${trimmedQuery})
          ORDER BY rank DESC
          LIMIT ${topK};
        `;

        console.log(`[RetrievalService] Full-text search found ${retrieved.length} articles`);

        if (retrieved.length === 0) {
          return this.searchSubstring(query, userId, filter, topK);
        }

        const sources: SearchResult[] = retrieved.map((r) => {
          const excerpt = this.extractRelevantExcerpt(r.content, query, 300);
          return {
            articleId: r.articleId,
            title: r.title || '(untitled)',
            domain: r.domain || null,
            content: r.content,
            excerpt: excerpt,
            similarity: Math.round(r.rank * 100) / 100,
          };
        });

        const documents = sources.map((s, idx) =>
          `【资料${idx + 1}】标题：${s.title}\n来源：${s.domain || ''}\n片段：\n${s.excerpt}`
        ).join('\n\n');

        return { documents, sources };
      }

      if (filter?.collectionId) {
        const retrieved = await prisma.$queryRaw<
          Array<{
            articleId: string
            title: string | null
            domain: string | null
            content: string
            rank: number
          }>
        >`
          SELECT
            a.id as "articleId",
            a.title,
            a.domain,
            b.content,
            ts_rank(
              to_tsvector('simple', b.content),
              plainto_tsquery('simple', ${trimmedQuery})
            ) as rank
          FROM articles a
          JOIN article_bodies b ON a.id = b.article_id
          WHERE a.user_id = ${userId}::uuid
            AND a.deleted_at IS NULL
            AND a.collection_id = ${filter.collectionId}::uuid
            AND to_tsvector('simple', b.content) @@ plainto_tsquery('simple', ${trimmedQuery})
          ORDER BY rank DESC
          LIMIT ${topK};
        `;

        console.log(`[RetrievalService] Full-text search found ${retrieved.length} articles`);

        if (retrieved.length === 0) {
          return this.searchSubstring(query, userId, filter, topK);
        }

        const sources: SearchResult[] = retrieved.map((r) => {
          const excerpt = this.extractRelevantExcerpt(r.content, query, 300);
          return {
            articleId: r.articleId,
            title: r.title || '(untitled)',
            domain: r.domain || null,
            content: r.content,
            excerpt: excerpt,
            similarity: Math.round(r.rank * 100) / 100,
          };
        });

        const documents = sources.map((s, idx) =>
          `【资料${idx + 1}】标题：${s.title}\n来源：${s.domain || ''}\n片段：\n${s.excerpt}`
        ).join('\n\n');

        return { documents, sources };
      }

      const retrieved = await prisma.$queryRaw<
        Array<{
          articleId: string
          title: string | null
          domain: string | null
          content: string
          rank: number
        }>
      >`
        SELECT
          a.id as "articleId",
          a.title,
          a.domain,
          b.content,
          ts_rank(
            to_tsvector('simple', b.content),
            plainto_tsquery('simple', ${trimmedQuery})
          ) as rank
        FROM articles a
        JOIN article_bodies b ON a.id = b.article_id
        WHERE a.user_id = ${userId}::uuid
          AND a.deleted_at IS NULL
          AND to_tsvector('simple', b.content) @@ plainto_tsquery('simple', ${trimmedQuery})
        ORDER BY rank DESC
        LIMIT ${topK};
      `;

      console.log(`[RetrievalService] Full-text search found ${retrieved.length} articles`);

      // If still no results, try simple substring match as last resort
      if (retrieved.length === 0) {
        return this.searchSubstring(query, userId, filter, topK);
      }

      // Extract relevant excerpts around matching terms
      const sources: SearchResult[] = retrieved.map((r) => {
        const excerpt = this.extractRelevantExcerpt(r.content, query, 300);
        return {
          articleId: r.articleId,
          title: r.title || '(untitled)',
          domain: r.domain || null,
          content: r.content,
          excerpt: excerpt,
          similarity: Math.round(r.rank * 100) / 100,
        };
      });

      const documents = sources.map((s, idx) =>
        `【资料${idx + 1}】标题：${s.title}\n来源：${s.domain || ''}\n片段：\n${s.excerpt}`
      ).join('\n\n');

      return { documents, sources };

    } catch (error) {
      console.error("[RetrievalService] Full-text search error:", error);
      return { documents: "", sources: [] };
    }
  }

  private static formatResults(rows: RetrievalRow[]): RetrievalResult {
    const sources: SearchResult[] = rows.map((r) => {
      const content = r.content ?? ''
      const excerpt = content.length > 300 ? `${content.slice(0, 300)}...` : content
      return {
        articleId: r.articleId,
        title: r.title || '(untitled)',
        domain: r.domain || null,
        content,
        excerpt,
        similarity: typeof r.similarity === 'number' ? r.similarity : Number(r.similarity),
      }
    })

    const documents = sources
      .map(
        (s, idx) =>
          `【资料${idx + 1}】标题：${s.title}\n来源：${s.domain || ''}\n片段：\n${s.excerpt}`,
      )
      .join('\n\n')

    return { documents, sources }
  }
 
  
  private static async searchSubstring(query: string, userId: string, filter: RetrievalOptions['filter'], topK: number): Promise<RetrievalResult> {
    console.log(`[RetrievalService] Substring search for: "${query.substring(0, 50)}..."`);

    try {
      // Get candidate articles based on filter
      const articles = await prisma.article.findMany({
        where: {
          userId: userId,
          deletedAt: null,
          ...(filter?.articleIds?.length ? { id: { in: filter.articleIds } } : {}),
          ...(filter?.collectionId ? { collectionId: filter.collectionId } : {}),
        },
        select: {
          id: true,
          title: true,
          domain: true,
          body: { select: { content: true } }
        },
        take: 20 // Get more candidates for filtering
      });

      const queryLower = query.toLowerCase();
      const results: SearchResult[] = [];

      for (const article of articles) {
        const content = article.body?.content || '';
        if (content.toLowerCase().includes(queryLower)) {
          const excerpt = this.extractRelevantExcerpt(content, query, 300);
          results.push({
            articleId: article.id,
            title: article.title || '(untitled)',
            domain: article.domain || null,
            content: content,
            excerpt: excerpt,
            similarity: 0.5,
          });

          if (results.length >= topK) break;
        }
      }

      console.log(`[RetrievalService] Substring search found ${results.length} articles`);

      if (results.length === 0) {
        return { documents: "", sources: [] };
      }

      const documents = results.map((s, idx) =>
        `【资料${idx + 1}】标题：${s.title}\n来源：${s.domain || ''}\n片段：\n${s.excerpt}`
      ).join('\n\n');

      return { documents, sources: results };

    } catch (error) {
      console.error("[RetrievalService] Substring search error:", error);
      return { documents: "", sources: [] };
    }
  }

  private static extractRelevantExcerpt(content: string, query: string, maxLength: number): string {
    const contentLower = content.toLowerCase();
    const queryLower = query.toLowerCase();
    const index = contentLower.indexOf(queryLower);

    if (index === -1) {
      // Query not found, return beginning of content
      return content.length > maxLength ? content.slice(0, maxLength) + '...' : content;
    }

    // Calculate excerpt window around the match
    const contextLength = Math.floor((maxLength - query.length) / 2);
    const start = Math.max(0, index - contextLength);
    const end = Math.min(content.length, index + query.length + contextLength);

    let excerpt = content.slice(start, end);

    if (start > 0) excerpt = '...' + excerpt;
    if (end < content.length) excerpt = excerpt + '...';

    return excerpt;
  }
}
