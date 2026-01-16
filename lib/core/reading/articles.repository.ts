import { prisma } from '@/lib/infrastructure/database/prisma';
import { NotFoundError } from '@/lib/infrastructure/error';
import { z } from 'zod';
import { ArticleSchema, ArticleUpdateSchema } from '@/lib/shared/validation/schemas';
import { generateEmbedding } from '@/lib/infrastructure/ai/embedding';
import { createId } from '@paralleldrive/cuid2';

type CreateArticleInput = z.infer<typeof ArticleSchema>;
type UpdateArticleInput = z.infer<typeof ArticleUpdateSchema>;

export interface PaginationOptions {
  page?: number;
  pageSize?: number;
  limit?: number; // Deprecated, use pageSize
  type?: string;
  includeCollectionArticles?: boolean;  // If true, include book chapters
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export class ArticlesRepository {
  static async findAll(userId: string, options?: PaginationOptions) {
    const { page = 1, pageSize = 20, type, includeCollectionArticles = false } = options || {};

    const where: any = {
      userId,
      deletedAt: null,
    };

    // Only show standalone articles by default (not book chapters)
    if (!includeCollectionArticles) {
      where.collectionId = null;
    }

    if (type) {
      where.type = type;
    }

    // Count total items
    const total = await prisma.article.count({ where });

    // Calculate pagination
    const skip = (page - 1) * pageSize;
    const totalPages = Math.ceil(total / pageSize);

    // Fetch items
    const items = await prisma.article.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      select: {
        id: true,
        title: true,
        type: true,
        url: true,
        domain: true,
        progress: true,
        totalBlocks: true,
        completedBlocks: true,
        totalReadingTime: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      items,
      total,
      page,
      pageSize,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    };
  }

  static async findById(id: string, userId: string) {
    const article = await prisma.article.findFirst({
      where: {
        id,
        userId,
        deletedAt: null,
      },
    });

    if (!article) {
      throw new NotFoundError('Article not found');
    }

    return article;
  }

  static async create(userId: string, data: CreateArticleInput) {
    // Generate embedding for article metadata (title + domain + first 200 chars of content)
    let embedding: number[] | undefined;
    try {
      const title = data.title || 'Untitled';
      const domain = data.domain || '';
      const contentSnippet = data.content.slice(0, 200);
      const textToEmbed = `Title: ${title}\nDomain: ${domain}\nContent: ${contentSnippet}`;
      
      embedding = await generateEmbedding(textToEmbed);
    } catch (error) {
      console.warn('Failed to generate embedding for new article:', error);
    }

    // ID is optional in schema but usually provided by frontend or generated
    // If id is provided in data, use it.
    
    const article = await prisma.article.create({
      data: {
        id: data.id || createId(), // Use cuid2 for consistent ID generation
        userId,
        title: data.title || null,
        content: data.content,
        type: data.type,
        url: data.url || null,
        domain: data.domain || null,
        progress: data.progress,
        totalBlocks: data.totalBlocks,
        completedBlocks: data.completedBlocks,
      },
    });

    // Update with embedding if available
    if (embedding) {
      await this.updateEmbedding(article.id, embedding);
    }

    return article;
  }

  static async update(userId: string, data: UpdateArticleInput) {
    const { id, ...updateData } = data;

    // Verify ownership
    const existing = await this.findById(id, userId);

    const updated = await prisma.article.update({
      where: { id },
      data: {
        ...updateData,
        updatedAt: new Date(),
      },
    });

    // If title or content changed, regenerate embedding
    if ((updateData.title && updateData.title !== existing.title) || 
        (updateData.content && updateData.content.slice(0, 200) !== existing.content.slice(0, 200))) {
      try {
        const title = updateData.title || existing.title || 'Untitled';
        const domain = existing.domain || '';
        const content = updateData.content || existing.content;
        const contentSnippet = content.slice(0, 200);
        
        const textToEmbed = `Title: ${title}\nDomain: ${domain}\nContent: ${contentSnippet}`;
        const embedding = await generateEmbedding(textToEmbed);
        await this.updateEmbedding(id, embedding);
      } catch (error) {
        console.warn('Failed to update embedding for modified article:', error);
      }
    }

    return updated;
  }

  static async softDelete(id: string, userId: string) {
    // Verify ownership
    await this.findById(id, userId);

    return prisma.article.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Helper to update embedding using raw SQL
   */
  private static async updateEmbedding(id: string, embedding: number[]) {
    // Format vector as string: '[0.1, 0.2, ...]'
    const vectorStr = `[${embedding.join(',')}]`;
    
    // Explicitly cast to vector(1536) to match the schema definition
    // Note: Article ID is defined as VARCHAR(255) in schema, not UUID.
    // So we treat it as text in SQL.
    await prisma.$executeRaw`
      UPDATE articles 
      SET embedding = ${vectorStr}::vector(1536)
      WHERE id = ${id}
    `;
  }

  /**
   * Find semantically similar articles
   */
  static async findRelated(userId: string, text: string, limit = 5, threshold = 0.7) {
    const embedding = await generateEmbedding(text);
    const vectorStr = `[${embedding.join(',')}]`;

    const results = await prisma.$queryRaw`
      SELECT 
        id, 
        title, 
        domain,
        url,
        1 - (embedding <=> ${vectorStr}::vector(1536)) as similarity
      FROM articles
      WHERE user_id = ${userId}::uuid
        AND deleted_at IS NULL
        AND embedding IS NOT NULL
        AND 1 - (embedding <=> ${vectorStr}::vector(1536)) > ${threshold}
      ORDER BY similarity DESC
      LIMIT ${limit};
    `;

    return results as Array<{
      id: string;
      title: string;
      domain: string;
      url: string;
      similarity: number;
    }>;
  }
}
