/**
 * 重构后的检索服务 - 改进版
 * 
 * 改进点:
 * 1. 使用查询构建器消除SQL重复
 * 2. 添加缓存层提高性能
 * 3. 改进摘录提取算法
 * 4. 统一错误处理
 * 5. 可配置的RRF权重
 */

import { prisma } from '@/lib/infrastructure/database/prisma';
import { Prisma } from '@/lib/generated/prisma';
import { RetrievalOptions, RetrievalResult, SearchResult } from './types';
import { RetrievalCache } from './cache';
import { ExcerptExtractor } from './excerpt-extractor';

type RetrievalRow = {
  id: string;
  content: string;
  articleId: string;
  title: string | null;
  domain: string | null;
  similarity: number;
};

/**
 * RRF配置
 */
interface RRFConfig {
  k: number;              // RRF常数，默认60
  vectorWeight: number;   // 向量检索权重，默认1.0
  fullTextWeight: number; // 全文检索权重，默认1.5
}

export class RetrievalService {
  private static readonly DEFAULT_RRF_CONFIG: RRFConfig = {
    k: 60,
    vectorWeight: 1.0,
    fullTextWeight: 1.5,
  };

  /**
   * 主检索入口（改进版）
   */
  static async search(
    options: RetrievalOptions,
    rrfConfig: Partial<RRFConfig> = {}
  ): Promise<RetrievalResult> {
    const { query, userId, mode = 'fast', topK = 5 } = options;

    // 1. 验证输入
    if (!query?.trim()) {
      console.warn('[RetrievalService] Empty query');
      return { documents: '', sources: [] };
    }

    if (!this.isUuid(userId)) {
      throw new Error('Invalid userId (expected UUID string)');
    }

    const filter = this.sanitizeFilter(options.filter);

    // 2. 检查缓存
    const cached = RetrievalCache.getResultCache(query, userId, filter, mode, topK);
    if (cached) {
      return cached;
    }

    // 3. Comprehensive模式：返回文章摘要
    if (mode === 'comprehensive' && (filter?.articleIds?.length || filter?.collectionId)) {
      const result = await this.searchSummaries(userId, filter);
      RetrievalCache.setResultCache(query, userId, filter, mode, topK, result);
      return result;
    }

    // 4. 混合检索：并行执行
    try {
      const [vectorResult, fullTextResult] = await Promise.all([
        this.searchChunks(query, userId, filter, topK),
        this.searchFullText(query, userId, filter, topK),
      ]);

      // 5. 融合结果
      const mergedConfig = { ...this.DEFAULT_RRF_CONFIG, ...rrfConfig };
      const result = this.mergeResults(vectorResult, fullTextResult, topK, mergedConfig);

      // 6. 缓存结果
      RetrievalCache.setResultCache(query, userId, filter, mode, topK, result);

      return result;
    } catch (error) {
      console.error('[RetrievalService] Search failed:', error);
      throw new Error(`Retrieval failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 向量检索（简化版）
   */
  private static async searchChunks(
    query: string,
    userId: string,
    filter: RetrievalOptions['filter'],
    topK: number
  ): Promise<RetrievalResult> {
    try {
      // 1. 生成查询向量（带缓存）
      const queryVector = await RetrievalCache.getOrGenerateEmbedding(query);

      // 2. 构建WHERE条件
      const whereConditions: string[] = [
        'c.user_id = ${userId}::uuid',
        'a.deleted_at IS NULL',
      ];

      const params: any = { userId, queryVector: JSON.stringify(queryVector), topK };

      if (filter?.articleIds?.length) {
        whereConditions.push('c.article_id = ANY(${articleIds}::uuid[])');
        params.articleIds = filter.articleIds;
      } else if (filter?.collectionId) {
        whereConditions.push('a.collection_id = ${collectionId}::uuid');
        params.collectionId = filter.collectionId;
      }

      // 3. 执行查询（统一的SQL）
      const results = await prisma.$queryRaw<RetrievalRow[]>`
        SELECT 
          c.id, 
          c.content, 
          a.id as "articleId", 
          a.title, 
          a.domain,
          1 - (c.embedding <=> ${params.queryVector}::vector) as similarity
        FROM article_chunks c
        JOIN articles a ON c.article_id = a.id
        WHERE ${Prisma.raw(whereConditions.join(' AND '))}
        ORDER BY c.embedding <=> ${params.queryVector}::vector
        LIMIT ${params.topK}
      `;

      return this.formatResults(results, query);
    } catch (error) {
      console.error('[RetrievalService] Vector search failed:', error);
      return { documents: '', sources: [] };
    }
  }

  /**
   * 全文检索（简化版）
   */
  private static async searchFullText(
    query: string,
    userId: string,
    filter: RetrievalOptions['filter'],
    topK: number
  ): Promise<RetrievalResult> {
    try {
      const trimmedQuery = query.trim();

      // 1. 构建WHERE条件
      const whereConditions: string[] = [
        'a.user_id = ${userId}::uuid',
        'a.deleted_at IS NULL',
        "to_tsvector('simple', b.content) @@ plainto_tsquery('simple', ${query})",
      ];

      const params: any = { userId, query: trimmedQuery, topK };

      if (filter?.articleIds?.length) {
        whereConditions.push('a.id = ANY(ARRAY[${articleIds}]::uuid[])');
        params.articleIds = filter.articleIds;
      } else if (filter?.collectionId) {
        whereConditions.push('a.collection_id = ${collectionId}::uuid');
        params.collectionId = filter.collectionId;
      }

      // 2. 执行查询
      const retrieved = await prisma.$queryRaw<
        Array<{
          articleId: string;
          title: string | null;
          domain: string | null;
          content: string;
          rank: number;
        }>
      >`
        SELECT
          a.id as "articleId",
          a.title,
          a.domain,
          b.content,
          ts_rank(
            to_tsvector('simple', b.content),
            plainto_tsquery('simple', ${params.query})
          ) as rank
        FROM articles a
        JOIN article_bodies b ON a.id = b.article_id
        WHERE ${Prisma.raw(whereConditions.join(' AND '))}
        ORDER BY rank DESC
        LIMIT ${params.topK}
      `;

      // 3. 如果没有结果，回退到子串匹配
      if (retrieved.length === 0) {
        return this.searchSubstring(query, userId, filter, topK);
      }

      // 4. 格式化结果（使用改进的摘录提取）
      const sources: SearchResult[] = retrieved.map((r) => {
        const excerpt = ExcerptExtractor.extract(r.content, query, 300);
        return {
          articleId: r.articleId,
          title: r.title || '(untitled)',
          domain: r.domain || null,
          content: r.content,
          excerpt,
          similarity: Math.round(r.rank * 100) / 100,
        };
      });

      const documents = sources
        .map((s, idx) => `【资料${idx + 1}】标题：${s.title}\n来源：${s.domain || ''}\n片段：\n${s.excerpt}`)
        .join('\n\n');

      return { documents, sources };
    } catch (error) {
      console.error('[RetrievalService] Full-text search failed:', error);
      return { documents: '', sources: [] };
    }
  }

  /**
   * RRF融合算法（改进版）
   */
  private static mergeResults(
    vectorResult: RetrievalResult,
    fullTextResult: RetrievalResult,
    topK: number,
    config: RRFConfig
  ): RetrievalResult {
    const { k, vectorWeight, fullTextWeight } = config;
    const scores = new Map<string, { source: SearchResult; score: number }>();

    // 1. 向量检索结果评分
    vectorResult.sources.forEach((source, index) => {
      const rank = index + 1;
      const rrfScore = vectorWeight / (k + rank);
      scores.set(source.articleId, { source, score: rrfScore });
    });

    // 2. 全文检索结果评分并合并
    fullTextResult.sources.forEach((source, index) => {
      const rank = index + 1;
      const rrfScore = fullTextWeight / (k + rank);
      const existing = scores.get(source.articleId);

      if (existing) {
        // 在两个结果中都出现，累加分数
        existing.score += rrfScore;
        // 合并source数据（优先使用有更多信息的）
        existing.source = this.mergeSourceData(existing.source, source);
      } else {
        scores.set(source.articleId, { source, score: rrfScore });
      }
    });

    // 3. 排序并取topK
    const mergedSources = Array.from(scores.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((item) => ({
        ...item.source,
        similarity: item.score, // 使用融合后的分数
      }));

    // 4. 构建文档字符串
    const documents = mergedSources
      .map((s, idx) => `【资料${idx + 1}】标题：${s.title}\n来源：${s.domain || ''}\n片段：\n${s.excerpt}`)
      .join('\n\n');

    return { documents, sources: mergedSources };
  }

  /**
   * 合并source数据
   */
  private static mergeSourceData(source1: SearchResult, source2: SearchResult): SearchResult {
    return {
      articleId: source1.articleId,
      title: source1.title || source2.title,
      domain: source1.domain || source2.domain,
      content: source1.content.length > source2.content.length ? source1.content : source2.content,
      excerpt: source1.excerpt.length > source2.excerpt.length ? source1.excerpt : source2.excerpt,
      similarity: Math.max(source1.similarity, source2.similarity),
    };
  }

  /**
   * 格式化结果（使用改进的摘录提取）
   */
  private static formatResults(rows: RetrievalRow[], query: string): RetrievalResult {
    const sources: SearchResult[] = rows.map((r) => {
      const content = r.content ?? '';
      const excerpt = ExcerptExtractor.extract(content, query, 300);
      
      return {
        articleId: r.articleId,
        title: r.title || '(untitled)',
        domain: r.domain || null,
        content,
        excerpt,
        similarity: typeof r.similarity === 'number' ? r.similarity : Number(r.similarity),
      };
    });

    const documents = sources
      .map((s, idx) => `【资料${idx + 1}】标题：${s.title}\n来源：${s.domain || ''}\n片段：\n${s.excerpt}`)
      .join('\n\n');

    return { documents, sources };
  }

  /**
   * 搜索摘要（保持不变）
   */
  private static async searchSummaries(
    userId: string,
    filter: RetrievalOptions['filter']
  ): Promise<RetrievalResult> {
    try {
      let articles: Array<{
        id: string;
        title: string | null;
        summary: string | null;
        domain: string | null;
      }> = [];

      if (filter?.collectionId) {
        articles = await prisma.article.findMany({
          where: {
            collectionId: filter.collectionId,
            userId: userId,
            deletedAt: null,
          },
          select: { id: true, title: true, summary: true, domain: true },
        });
      } else if (filter?.articleIds?.length) {
        articles = await prisma.article.findMany({
          where: {
            id: { in: filter.articleIds },
            userId: userId,
            deletedAt: null,
          },
          select: { id: true, title: true, summary: true, domain: true },
        });
      }

      const sources: SearchResult[] = articles.map((a) => ({
        articleId: a.id,
        title: a.title || '(untitled)',
        domain: a.domain || null,
        content: a.summary || 'No summary available.',
        excerpt: a.summary ? a.summary.slice(0, 200) + '...' : 'No summary.',
        similarity: 1.0,
      }));

      const documents = sources
        .map((s, idx) => `【Article ${idx + 1}】Title: ${s.title}\nSummary: ${s.content}`)
        .join('\n\n');

      return { documents, sources };
    } catch (error) {
      console.error('[RetrievalService] Failed to fetch summaries:', error);
      return { documents: '', sources: [] };
    }
  }

  /**
   * 子串搜索（降级策略）
   */
  private static async searchSubstring(
    query: string,
    userId: string,
    filter: RetrievalOptions['filter'],
    topK: number
  ): Promise<RetrievalResult> {
    try {
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
          body: { select: { content: true } },
        },
        take: 20,
      });

      const queryLower = query.toLowerCase();
      const results: SearchResult[] = [];

      for (const article of articles) {
        const content = article.body?.content || '';
        if (content.toLowerCase().includes(queryLower)) {
          const excerpt = ExcerptExtractor.extract(content, query, 300);
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

      if (results.length === 0) {
        return { documents: '', sources: [] };
      }

      const documents = results
        .map((s, idx) => `【资料${idx + 1}】标题：${s.title}\n来源：${s.domain || ''}\n片段：\n${s.excerpt}`)
        .join('\n\n');

      return { documents, sources: results };
    } catch (error) {
      console.error('[RetrievalService] Substring search failed:', error);
      return { documents: '', sources: [] };
    }
  }

  /**
   * UUID验证
   */
  private static isUuid(value: unknown): value is string {
    if (typeof value !== 'string') return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value.trim()
    );
  }

  /**
   * 过滤器清理
   */
  private static sanitizeFilter(filter: RetrievalOptions['filter']): RetrievalOptions['filter'] {
    if (!filter) return undefined;

    const articleIds = Array.isArray(filter.articleIds)
      ? filter.articleIds
          .map((v) => (typeof v === 'string' ? v.trim() : ''))
          .filter((v) => v.length > 0 && this.isUuid(v))
      : undefined;

    const collectionId = this.isUuid(filter.collectionId) ? filter.collectionId : undefined;
    const domain = typeof filter.domain === 'string' ? filter.domain : undefined;

    return {
      ...(articleIds && articleIds.length > 0 ? { articleIds: Array.from(new Set(articleIds)) } : {}),
      ...(collectionId ? { collectionId } : {}),
      ...(domain ? { domain } : {}),
    };
  }
}

