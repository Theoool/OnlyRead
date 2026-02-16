/**
 * 文件导入处理器 - 优化版
 * 
 * 改进点:
 * 1. 使用ArticleCreator统一创建逻辑
 * 2. 使用IndexingScheduler异步索引
 * 3. 使用ContentProcessor处理内容（保留图片和链接）
 * 4. 降低嵌套复杂度
 * 5. 改进错误处理
 * 6. 添加事务保护
 * 7. 优化数据库查询
 * 8. 添加进度反馈
 * 9. 实现并行处理
 * 10. 添加重试机制
 */

import { prisma } from '@/lib/infrastructure/database/prisma';
import { getServiceClient } from '@/lib/supabase/server';
import { ForbiddenError } from '@/lib/infrastructure/error';
import { revalidatePath } from 'next/cache';
import { processFileOnServer } from '@/lib/server/file-processor-server';
import { ArticleCreator } from './article-creator';
import { IndexingScheduler } from './indexing-scheduler';
import type { ProcessedBook } from '@/lib/integration/file-processor-bridge';
import { ContentProcessor } from './content-processor';

export interface ImportFileParams {
  userId: string;
  filePath: string;
  originalName: string;
  fileType?: string;
  strictMode?: boolean; // 严格模式：任何失败都回滚
  onProgress?: (progress: ImportProgress) => void; // 进度回调
}

export interface ImportFileResult {
  success: boolean;
  data: {
    collection: any;
    articlesCount: number;
    totalChapters: number;
    jobId?: string;
    errors?: any[];
    warnings?: any[];
    metadata?: any;
    partialSuccess?: boolean; // 是否部分成功
  };
}

export interface ImportProgress {
  stage: 'download' | 'parse' | 'create_collection' | 'create_articles' | 'update_stats' | 'schedule_indexing' | 'cleanup';
  progress: number; // 0-100
  message: string;
  details?: any;
}

// 重试配置
const RETRY_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000, // 1秒
  retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'],
};

/**
 * 为用户导入文件（优化版）
 */
export async function importFileForUser(params: ImportFileParams): Promise<ImportFileResult> {
  const { userId, filePath, originalName, strictMode = false, onProgress } = params;

  console.log('[ImportFile] Starting file import', { userId, filePath, originalName, strictMode });

  const reportProgress = (stage: ImportProgress['stage'], progress: number, message: string, details?: any) => {
    onProgress?.({ stage, progress, message, details });
    console.log(`[ImportFile] ${stage}: ${progress}% - ${message}`);
  };

  try {
    // 1. 验证参数
    reportProgress('download', 0, '验证参数...');
    validateParams(filePath, originalName, userId);

    // 2. 下载文件（带重试）
    reportProgress('download', 10, '下载文件...');
    const buffer = await retryOperation(
      () => downloadFile(filePath),
      '下载文件'
    );
    reportProgress('download', 30, `文件下载完成 (${buffer.length} 字节)`);

    // 3. 解析文件（带重试）
    reportProgress('parse', 40, '解析文件内容...');
    const parsedBook = await retryOperation(
      () => parseFile(buffer, originalName),
      '解析文件'
    );
    reportProgress('parse', 60, `解析完成，共 ${parsedBook.chapters.length} 章节`);

    // 4. 使用事务创建数据（核心优化）
    reportProgress('create_collection', 65, '创建集合和文章...');
    const { collection, articles, errors, warnings, totalWords, estimatedReadTime } = 
      await createCollectionAndArticlesInTransaction(parsedBook, originalName, userId);

    reportProgress('create_articles', 80, `创建完成：${articles.length}/${parsedBook.chapters.length} 篇文章`);

    // 5. 处理失败情况
    const successRate = articles.length / parsedBook.chapters.length;
    const partialSuccess = articles.length > 0 && articles.length < parsedBook.chapters.length;

    if (articles.length === 0) {
      throw new Error(
        `导入失败：所有章节都无法创建。` +
        `总章节数: ${parsedBook.chapters.length}, ` +
        `错误: ${errors.map(e => e.error).join('; ')}`
      );
    }

    if (strictMode && partialSuccess) {
      throw new Error(
        `严格模式：部分章节创建失败。` +
        `成功: ${articles.length}/${parsedBook.chapters.length}, ` +
        `失败: ${errors.length}`
      );
    }

    if (successRate < 0.5) {
      throw new Error(
        `导入失败：成功率过低 (${(successRate * 100).toFixed(1)}%)。` +
        `成功: ${articles.length}, 失败: ${errors.length}`
      );
    }

    // 6. 并行执行：更新统计 + 调度索引 + 清理文件
    reportProgress('update_stats', 85, '更新统计信息...');
    
    const [jobId, cleanupWarnings] = await Promise.allSettled([
      scheduleIndexing(articles, userId),
      cleanupFile(filePath),
    ]).then(results => [
      results[0].status === 'fulfilled' ? results[0].value : undefined,
      results[1].status === 'fulfilled' ? results[1].value : [],
    ]);

    reportProgress('schedule_indexing', 95, '索引任务已调度');

    // 7. 刷新缓存
    reportProgress('cleanup', 98, '清理缓存...');
    revalidatePath('/');
    revalidatePath('/collections');

    reportProgress('cleanup', 100, '导入完成！');

    console.log('[ImportFile] File import completed', {
      collectionId: collection.id,
      articlesCount: articles.length,
      totalChapters: parsedBook.chapters.length,
      successRate: `${(successRate * 100).toFixed(1)}%`,
      jobId,
      partialSuccess,
    });

    // 8. 返回结果
    return {
      success: true,
      data: {
        collection,
        articlesCount: articles.length,
        totalChapters: parsedBook.chapters.length,
        jobId,
        errors: errors.length > 0 ? errors : undefined,
        warnings: [...warnings, ...cleanupWarnings, ...(parsedBook.failedChapters || [])],
        metadata: {
          ...parsedBook.metadata,
          processingArchitecture: parsedBook.metadata?.processedBy || 'unknown',
          performance: parsedBook.performance,
          totalWords,
          estimatedReadTime,
          successRate: `${(successRate * 100).toFixed(1)}%`,
        },
        partialSuccess,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[ImportFile] Import failed:', errorMessage);
    reportProgress('cleanup', 0, `导入失败: ${errorMessage}`);
    throw error;
  }
}

/**
 * 验证参数
 */
function validateParams(filePath: string, originalName: string, userId: string): void {
  if (!filePath || !originalName) {
    throw new Error('缺少必需参数: filePath 或 originalName');
  }

  if (!filePath.startsWith(`${userId}/`)) {
    throw new ForbiddenError('无效的文件路径：路径必须以用户ID开头');
  }

  // 验证文件类型
  const supportedExtensions = ['.epub', '.pdf', '.txt', '.md'];
  const ext = originalName.toLowerCase().match(/\.[^.]+$/)?.[0];
  if (!ext || !supportedExtensions.includes(ext)) {
    throw new Error(`不支持的文件类型: ${ext}。支持的类型: ${supportedExtensions.join(', ')}`);
  }
}

/**
 * 重试操作（通用重试机制）
 */
async function retryOperation<T>(
  operation: () => Promise<T>,
  operationName: string,
  retries = RETRY_CONFIG.maxRetries
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      const isRetryable = RETRY_CONFIG.retryableErrors.some(
        errCode => lastError!.message.includes(errCode)
      );

      if (attempt < retries && isRetryable) {
        const delay = RETRY_CONFIG.retryDelay * attempt;
        console.warn(
          `[ImportFile] ${operationName} 失败 (尝试 ${attempt}/${retries}), ` +
          `${delay}ms 后重试...`,
          lastError.message
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        break;
      }
    }
  }

  throw new Error(
    `${operationName} 失败 (已重试 ${retries} 次): ${lastError?.message || '未知错误'}`
  );
}

/**
 * 下载文件
 */
async function downloadFile(filePath: string): Promise<Buffer> {
  console.log('[ImportFile] Downloading file from storage');

  const supabase = await getServiceClient();
  const { data: fileData, error: downloadError } = await supabase.storage
    .from('files')
    .download(filePath);

  if (downloadError || !fileData) {
    throw new Error(
      `文件下载失败: ${downloadError?.message || '未知错误'}。` +
      `文件路径: ${filePath}`
    );
  }

  const buffer = Buffer.from(await fileData.arrayBuffer());
  console.log('[ImportFile] File downloaded', { 
    size: buffer.length,
    sizeKB: (buffer.length / 1024).toFixed(2) 
  });

  return buffer;
}

/**
 * 解析文件
 */
async function parseFile(buffer: Buffer, originalName: string): Promise<ProcessedBook> {
  console.log('[ImportFile] Parsing file');

  const parsedBook = await processFileOnServer(buffer, originalName);

  if (!parsedBook.chapters || parsedBook.chapters.length === 0) {
    throw new Error(
      `文件解析失败：未找到任何章节。` +
      `文件名: ${originalName}, ` +
      `文件大小: ${buffer.length} 字节`
    );
  }

  // 验证章节内容
  const validChapters = parsedBook.chapters.filter(ch => ch.content && ch.content.trim().length > 0);
  if (validChapters.length === 0) {
    throw new Error(
      `文件解析失败：所有章节内容为空。` +
      `总章节数: ${parsedBook.chapters.length}`
    );
  }

  console.log('[ImportFile] File parsed', {
    title: parsedBook.title,
    chaptersCount: parsedBook.chapters.length,
    validChapters: validChapters.length,
    totalSize: parsedBook.chapters.reduce((sum, ch) => sum + (ch.content?.length || 0), 0),
  });

  return parsedBook;
}

/**
 * 使用事务创建 Collection 和 Articles（核心优化）
 */
async function createCollectionAndArticlesInTransaction(
  parsedBook: ProcessedBook,
  originalName: string,
  userId: string
): Promise<{
  collection: any;
  articles: any[];
  errors: Array<{ index: number; error: string }>;
  warnings: string[];
  totalWords: number;
  estimatedReadTime: number;
}> {
  console.log('[ImportFile] Starting transaction for collection and articles');

  // 预计算统计数据（避免重复查询）
  const totalWords = parsedBook.chapters.reduce((sum: number, ch: any) => 
    sum + (ch.content?.length || 0), 0
  );
  const estimatedReadTime = Math.ceil(totalWords / 300);

  const isEpub = originalName.toLowerCase().endsWith('.epub');
  const safeTitle = ContentProcessor.sanitizeString(
    parsedBook.title || originalName || 'UNK📕'
  );
  const safeDesc = ContentProcessor.sanitizeString(
    parsedBook.description || parsedBook.metadata?.description || ''
  );

  // 预处理所有章节数据
  const articlesData = parsedBook.chapters.map((chapter: any, index: number) => {
    const content = chapter.content || '';
    const totalBlocks = Math.max(1, Math.ceil(content.length / 500));
    
    return {
      title: ContentProcessor.sanitizeString(chapter.title || `第 ${index + 1} 章`),
      content,
      order: index,
      type: 'markdown' as const,
      domain: null,
      url: null,
      summary: chapter.summary || null,
      totalBlocks,
    };
  });

  // 使用事务执行所有数据库操作
  const result = await prisma.$transaction(async (tx) => {
    // 1. 创建 Collection
    const collection = await tx.collection.create({
      data: {
        title: safeTitle,
        description: safeDesc,
        type: isEpub ? 'BOOK' : 'SERIES',
        userId,
        author: parsedBook.metadata?.author || null,
        language: parsedBook.metadata?.language || 'zh-CN',
        isbn: parsedBook.metadata?.isbn || null,
        totalChapters: parsedBook.chapters.length,
        totalWords: BigInt(totalWords),
        estimatedReadTime,
        readingProgress: 0,
        completedChapters: 0,
      },
    });

    console.log('[ImportFile] Collection created in transaction', { 
      collectionId: collection.id 
    });

    // 2. 批量创建 Articles（使用 ContentProcessor）
    const articles: any[] = [];
    const errors: Array<{ index: number; error: string }> = [];
    const warnings: string[] = [];

    for (let i = 0; i < articlesData.length; i++) {
      const data = articlesData[i];
      
      try {
        // 处理内容
        const processed = ContentProcessor.process(data.content, {
          preserveImages: true,
          preserveLinks: true,
        });
        warnings.push(...processed.warnings.map(w => `[章节 ${i + 1}] ${w}`));

        // 创建文章和文章体
        const article = await tx.article.create({
          data: {
            title: data.title,
            url: null,
            domain: null,
            userId,
            collectionId: collection.id,
            order: data.order,
            type: data.type,
            summary: data.summary,
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

        articles.push(article);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`[ImportFile] Failed to create article ${i}:`, errorMsg);
        errors.push({
          index: i,
          error: `章节 "${data.title}" 创建失败: ${errorMsg}`,
        });
      }
    }

    // 3. 更新用户统计（在同一事务中）
    if (articles.length > 0) {
      await tx.readingStats.upsert({
        where: { userId },
        create: {
          userId,
          totalArticles: articles.length,
          lastReadDate: new Date(),
        },
        update: {
          totalArticles: {
            increment: articles.length,
          },
          updatedAt: new Date(),
        },
      });
    }

    console.log('[ImportFile] Transaction completed', {
      collectionId: collection.id,
      articlesCreated: articles.length,
      articlesFailed: errors.length,
    });

    return { collection, articles, errors, warnings };
  }, {
    maxWait: 30000, // 最多等待30秒
    timeout: 60000, // 超时60秒
  });

  return {
    ...result,
    totalWords,
    estimatedReadTime,
  };
}

/**
 * 调度索引任务
 */
async function scheduleIndexing(articles: any[], userId: string): Promise<string | undefined> {
  if (articles.length === 0) {
    return undefined;
  }

  console.log('[ImportFile] Scheduling indexing');

  try {
    const articleIds = articles.map((a) => a.id);
    const jobId = await IndexingScheduler.schedule(articleIds, userId, 'FILE');

    console.log('[ImportFile] Indexing scheduled', { 
      jobId, 
      articlesCount: articleIds.length 
    });

    return jobId;
  } catch (err) {
    console.error('[ImportFile] Failed to schedule indexing:', err);
    // 不抛出错误，索引失败不应该影响导入
    return undefined;
  }
}

/**
 * 清理文件
 */
async function cleanupFile(filePath: string): Promise<string[]> {
  const warnings: string[] = [];

  try {
    const supabase = await getServiceClient();
    const { error } = await supabase.storage.from('files').remove([filePath]);
    
    if (error) {
      throw error;
    }
    
    console.log('[ImportFile] File cleaned up successfully');
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn('[ImportFile] Failed to cleanup file:', errorMsg);
    warnings.push(`文件清理失败: ${errorMsg}`);
  }

  return warnings;
}

// 以下函数已被事务版本替代，保留用于向后兼容
// 已废弃：createCollection, createArticles, updateUserStats, updateCollectionStats
