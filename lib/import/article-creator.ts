/**
 * 文章创建器 - 统一的文章创建逻辑
 */

import { prisma } from '@/lib/infrastructure/database/prisma';
import { ContentProcessor } from './content-processor';

export interface ArticleData {
  title: string;
  content: string;
  url?: string;
  domain?: string;
  userId: string;
  collectionId?: string | null;
  order?: number;
  type?: 'markdown' | 'html';
}

export interface CreateArticleResult {
  article: any;
  warnings: string[];
}

export interface BatchCreateResult {
  articles: any[];
  succeeded: number;
  failed: number;
  errors: Array<{ index: number; error: string }>;
  warnings: string[];
}

/**
 * 文章创建器类
 */
export class ArticleCreator {
  private static readonly BATCH_SIZE = 5; // 提高批次大小

  /**
   * 创建单篇文章
   */
  static async createOne(data: ArticleData): Promise<CreateArticleResult> {
    const warnings: string[] = [];

    // 处理内容
    const processed = ContentProcessor.process(data.content, {
      preserveImages: true,
      preserveLinks: true,
    });
    warnings.push(...processed.warnings);

    // 清理标题
    const safeTitle = ContentProcessor.sanitizeString(data.title || 'Untitled');

    // 创建文章
    const article = await prisma.article.create({
      data: {
        title: safeTitle,
        url: data.url || null,
        domain: data.domain !== undefined ? data.domain : (data.url ? new URL(data.url).hostname : null),
        userId: data.userId,
        collectionId: data.collectionId,
        order: data.order,
        type: data.type || 'markdown',
        totalBlocks: processed.metadata.totalBlocks,
        totalReadingTime: processed.metadata.estimatedReadingTime,
        progress: 0,
        currentPosition: 0,
        completedBlocks: 0,
        body: {
          create: {
            content: processed.content,
            markdown: processed.content,
          },
        },
      },
      include: {
        body: true,
      },
    });

    return { article, warnings };
  }

  /**
   * 批量创建文章（优化版）
   */
  static async createBatch(dataList: ArticleData[]): Promise<BatchCreateResult> {
    if (dataList.length === 0) {
      return {
        articles: [],
        succeeded: 0,
        failed: 0,
        errors: [],
        warnings: [],
      };
    }

    const articles: any[] = [];
    const errors: Array<{ index: number; error: string }> = [];
    const allWarnings: string[] = [];

    console.log(`[ArticleCreator] 开始批量创建 ${dataList.length} 篇文章`);

    // 分批处理
    for (let i = 0; i < dataList.length; i += this.BATCH_SIZE) {
      const batch = dataList.slice(i, i + this.BATCH_SIZE);
      const batchNum = Math.floor(i / this.BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(dataList.length / this.BATCH_SIZE);

      console.log(`[ArticleCreator] 处理第 ${batchNum}/${totalBatches} 批，包含 ${batch.length} 篇文章`);

      try {
        const batchResults = await this.processBatch(batch, i);
        articles.push(...batchResults.articles);
        errors.push(...batchResults.errors);
        allWarnings.push(...batchResults.warnings);
      } catch (err) {
        console.error(`[ArticleCreator] 批次 ${batchNum} 处理失败:`, err);
        
        // 记录整个批次的错误
        for (let j = 0; j < batch.length; j++) {
          errors.push({
            index: i + j,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    const succeeded = articles.length;
    const failed = errors.length;

    console.log(`[ArticleCreator] 批量创建完成: ${succeeded} 成功, ${failed} 失败`);

    return {
      articles,
      succeeded,
      failed,
      errors,
      warnings: allWarnings,
    };
  }

  /**
   * 处理单个批次
   */
  private static async processBatch(
    batch: ArticleData[],
    startIndex: number
  ): Promise<{
    articles: any[];
    errors: Array<{ index: number; error: string }>;
    warnings: string[];
  }> {
    const articles: any[] = [];
    const errors: Array<{ index: number; error: string }> = [];
    const warnings: string[] = [];

    // 预处理所有内容
    const processedBatch = batch.map((data, idx) => {
      try {
        const processed = ContentProcessor.process(data.content, {
          preserveImages: true,
          preserveLinks: true,
        });

        warnings.push(...processed.warnings.map(w => `[${startIndex + idx}] ${w}`));

        return {
          title: ContentProcessor.sanitizeString(data.title || 'Untitled'),
          content: processed.content,
          url: data.url || null,
          domain: data.domain !== undefined ? data.domain : (data.url ? new URL(data.url).hostname : null),
          userId: data.userId,
          collectionId: data.collectionId,
          order: data.order,
          type: data.type || 'markdown',
          totalBlocks: processed.metadata.totalBlocks,
          totalReadingTime: processed.metadata.estimatedReadingTime,
        };
      } catch (err) {
        errors.push({
          index: startIndex + idx,
          error: `预处理失败: ${err instanceof Error ? err.message : String(err)}`,
        });
        return null;
      }
    });

    // 过滤掉预处理失败的
    const validData = processedBatch.filter((d): d is NonNullable<typeof d> => d !== null);

    if (validData.length === 0) {
      return { articles, errors, warnings };
    }

    // 使用事务批量创建
    try {
      const createdArticles = await prisma.$transaction(
        validData.map((data) =>
          prisma.article.create({
            data: {
              ...data,
              progress: 0,
              currentPosition: 0,
              completedBlocks: 0,
              body: {
                create: {
                  content: data.content,
                  markdown: data.content,
                },
              },
            },
            include: {
              body: true,
            },
          })
        )
      );

      articles.push(...createdArticles);
    } catch (err) {
      // 事务失败，尝试逐个创建
      console.warn(`[ArticleCreator] 事务失败，尝试逐个创建:`, err);

      for (let i = 0; i < validData.length; i++) {
        try {
          const article = await prisma.article.create({
            data: {
              ...validData[i],
              progress: 0,
              currentPosition: 0,
              completedBlocks: 0,
              body: {
                create: {
                  content: validData[i].content,
                  markdown: validData[i].content,
                },
              },
            },
            include: {
              body: true,
            },
          });

          articles.push(article);
        } catch (createErr) {
          errors.push({
            index: startIndex + i,
            error: createErr instanceof Error ? createErr.message : String(createErr),
          });
        }
      }
    }

    return { articles, errors, warnings };
  }
}

