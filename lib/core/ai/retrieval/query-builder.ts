/**
 * SQL查询构建器 - 消除重复代码
 */

import { Prisma } from '@/lib/generated/prisma';

export interface QueryFilter {
  userId: string;
  articleIds?: string[];
  collectionId?: string;
  domain?: string;
}

/**
 * 构建WHERE条件片段
 */
export function buildWhereConditions(filter: QueryFilter): {
  conditions: string[];
  params: Record<string, any>;
} {
  const conditions: string[] = [
    'c.user_id = ${userId}::uuid',
    'a.deleted_at IS NULL',
  ];
  
  const params: Record<string, any> = {
    userId: filter.userId,
  };

  if (filter.articleIds?.length) {
    conditions.push('c.article_id = ANY(${articleIds}::uuid[])');
    params.articleIds = filter.articleIds;
  }

  if (filter.collectionId) {
    conditions.push('a.collection_id = ${collectionId}::uuid');
    params.collectionId = filter.collectionId;
  }

  if (filter.domain) {
    conditions.push('a.domain = ${domain}');
    params.domain = filter.domain;
  }

  return { conditions, params };
}

/**
 * 构建向量检索SQL
 */
export function buildVectorSearchQuery(
  filter: QueryFilter,
  topK: number
): { sql: string; params: Record<string, any> } {
  const { conditions, params } = buildWhereConditions(filter);
  
  const sql = `
    SELECT 
      c.id, 
      c.content, 
      a.id as "articleId", 
      a.title, 
      a.domain,
      1 - (c.embedding <=> \${queryVector}::vector) as similarity
    FROM article_chunks c
    JOIN articles a ON c.article_id = a.id
    WHERE ${conditions.join(' AND ')}
    ORDER BY c.embedding <=> \${queryVector}::vector
    LIMIT \${topK}
  `;

  return {
    sql,
    params: { ...params, topK },
  };
}

/**
 * 构建全文检索SQL
 */
export function buildFullTextSearchQuery(
  filter: QueryFilter,
  topK: number
): { sql: string; params: Record<string, any> } {
  const conditions: string[] = [
    'a.user_id = ${userId}::uuid',
    'a.deleted_at IS NULL',
    "to_tsvector('simple', b.content) @@ plainto_tsquery('simple', ${query})",
  ];

  const params: Record<string, any> = {
    userId: filter.userId,
  };

  if (filter.articleIds?.length) {
    conditions.push('a.id = ANY(ARRAY[${articleIds}]::uuid[])');
    params.articleIds = filter.articleIds;
  }

  if (filter.collectionId) {
    conditions.push('a.collection_id = ${collectionId}::uuid');
    params.collectionId = filter.collectionId;
  }

  const sql = `
    SELECT
      a.id as "articleId",
      a.title,
      a.domain,
      b.content,
      ts_rank(
        to_tsvector('simple', b.content),
        plainto_tsquery('simple', \${query})
      ) as rank
    FROM articles a
    JOIN article_bodies b ON a.id = b.article_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY rank DESC
    LIMIT \${topK}
  `;

  return {
    sql,
    params: { ...params, topK },
  };
}



