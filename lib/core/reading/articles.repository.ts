import { prisma } from '@/lib/infrastructure/database/prisma';
import { NotFoundError } from '@/lib/infrastructure/error';
import { z } from 'zod';
import { ArticleSchema, ArticleUpdateSchema } from '@/lib/shared/validation/schemas';
import { generateEmbedding } from '@/lib/infrastructure/ai/embedding';
// Use crypto.randomUUID for standard UUID generation
// import { createId } from '@paralleldrive/cuid2'; 

type CreateArticleInput = z.infer<typeof ArticleSchema>;
type UpdateArticleInput = z.infer<typeof ArticleUpdateSchema>;

export interface PaginationOptions {
  page?: number;
  pageSize?: number;
  type?: string;
  includeCollectionArticles?: boolean;
}

export class ArticlesRepository {
  static async findAll(userId: string, options?: PaginationOptions) {
    const { page = 1, pageSize = 20, type, includeCollectionArticles = false } = options || {};

    const where: any = {
      userId,
      deletedAt: null,
    };

    if (!includeCollectionArticles) {
      where.collectionId = null;
    }

    if (type) {
      where.type = type;
    }

    const total = await prisma.article.count({ where });
    const totalPages = Math.ceil(total / pageSize);

    const items = await prisma.article.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
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
        collectionId: true,
        collection: {
          select: {
            title: true
          }
        },
        order: true,
        // No content here - Vertical Partitioning
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
  

  static async findById(id: string, userId: string, options?: { withContent?: boolean }) {
    const { withContent = false } = options || {};

    const article = await prisma.article.findFirst({
      where: {
        id,
        userId,
        deletedAt: null,
      },
      include: {
        body: true,
      },
    });

    if (!article) {
      throw new NotFoundError('Article not found');
    }

    // Return structure matching the service layer expectation
    return {
      ...article,
      content: article.body?.content,
      markdown: article.body?.markdown,
      html: article.body?.html,
      body: undefined,
    };
  }

  static async create(userId: string, data: CreateArticleInput) {
    let embedding: number[] | undefined;
    
    // Generate embedding from content
    try {
      const title = data.title || 'Untitled';
      const domain = data.domain || '';
      const contentSnippet = data.content.slice(0, 200);
      const textToEmbed = `Title: ${title}\nDomain: ${domain}\nContent: ${contentSnippet}`;
      
      embedding = await generateEmbedding(textToEmbed);
    } catch (error) {
      console.warn('Failed to generate embedding:', error);
    }

    const article = await prisma.article.create({
      data: {
        // id: data.id || crypto.randomUUID(), // Let Prisma generate UUID or use provided
        ...(data.id ? { id: data.id } : {}),
        userId,
        title: data.title || null,
        type: data.type,
        url: data.url || null,
        domain: data.domain || null,
        progress: data.progress,
        totalBlocks: data.totalBlocks,
        completedBlocks: data.completedBlocks,
        // content: data.content, // REMOVED
        body: {
          create: {
            content: data.content,
            markdown: data.type === 'markdown' ? data.content : undefined,
            
          }
        }
      },
      include: {
        body: true
      }
    });

    if (embedding) {
      await this.updateEmbedding(article.id, embedding);
    }

    return {
      ...article,
      content: article.body?.content,
      markdown: article.body?.markdown,
      body: undefined
    };
  }

  static async update(userId: string, data: UpdateArticleInput) {
    const { id, ...updateData } = data;

    // Verify ownership
    const existing = await this.findById(id, userId, { withContent: true });

    // Prepare update data
    const { content, ...metaData } = updateData;
    
    const updatePayload: any = {
      ...metaData,
      updatedAt: new Date(),
    };

    if (content !== undefined) {
      updatePayload.body = {
        upsert: {
          create: {
            content: content,
            markdown: existing.type === 'markdown' ? content : undefined,
          },
          update: {
            content: content,
            markdown: existing.type === 'markdown' ? content : undefined,
          }
        }
      };
    }

    const updated = await prisma.article.update({
      where: { id },
      data: updatePayload,
      include: { body: true }
    });

    // Re-generate embedding if title or content changed
    const newContent = content || existing.content || '';
    const oldContent = existing.content || '';
    
    if ((updateData.title && updateData.title !== existing.title) || 
        (content && newContent.slice(0, 200) !== oldContent.slice(0, 200))) {
      try {
        const title = updateData.title || existing.title || 'Untitled';
        const domain = existing.domain || '';
        const contentSnippet = newContent.slice(0, 200);
        
        const textToEmbed = `Title: ${title}\nDomain: ${domain}\nContent: ${contentSnippet}`;
        const embedding = await generateEmbedding(textToEmbed);
        await this.updateEmbedding(id, embedding);
      } catch (error) {
        console.warn('Failed to update embedding:', error);
      }
    }

    // Update Search Vector if content/title changed (Async)
    if (updateData.title || content) {
        const t = updateData.title || existing.title || '';
        const c = content || existing.content || '';
        this.updateSearchVector(id, t, c).catch(console.error);
    }

    return {
      ...updated,
      content: updated.body?.content,
      markdown: updated.body?.markdown,
      body: undefined
    };
  }

  static async softDelete(id: string, userId: string) {
    await this.findById(id, userId); // Verify existence/ownership

    return prisma.article.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private static async updateEmbedding(id: string, embedding: number[]) {
    const vectorStr = `[${embedding.join(',')}]`;
    // Cast to vector(1536) explicitly
    await prisma.$executeRaw`
      UPDATE articles 
      SET embedding = ${vectorStr}::vector(1536)
      WHERE id = ${id}::uuid
    `;
  }

  private static async updateSearchVector(id: string, title: string, content: string) {
    // Use 'simple' configuration for broad compatibility
    await prisma.$executeRaw`
      UPDATE articles
      SET "searchVector" = to_tsvector('simple', ${title} || ' ' || ${content})
      WHERE id = ${id}::uuid
    `;
  }

  static async findRelated(userId: string, text: string, limit = 5, threshold = 0.7) {
    const embedding = await generateEmbedding(text);
    const vectorStr = `[${embedding.join(',')}]`;

    // Note: id is now uuid in schema
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
