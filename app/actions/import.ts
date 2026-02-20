'use server';

import { requireUser } from './utils';
import { extractFromUrl } from '@/lib/content-extraction/server';
import { prisma } from '@/lib/infrastructure/database/prisma';
import { ArticleCreator } from '@/lib/import/article-creator';
import { IndexingScheduler } from '@/lib/import/indexing-scheduler';
import { importFileForUser } from '@/lib/import/import-file';
import { revalidatePath } from 'next/cache';


export async function importUrl(url: string, collectionId?: string) {
  const user = await requireUser();
  
  console.log('[Import] Starting URL import', { url, userId: user.id, collectionId });

  // 验证URL
  if (!url) {
    throw new Error('Missing URL');
  }

  try {
    new URL(url);
  } catch (e) {
    throw new Error('Invalid URL format');
  }

  // 验证collectionId
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const validCollectionId = collectionId && uuidRegex.test(collectionId) ? collectionId : null;

  try {
    // 1. 提取内容
    console.log('[Import] Extracting content from URL');
    const extracted = await extractFromUrl(url, { 
      removeRecommendations: true,
      cacheEnabled: true,
    });

    console.log('[Import] Content extracted', {
      title: extracted.title,
      contentLength: extracted.content.length,
    });

    // 2. 创建文章
    const domain = new URL(url).hostname;
    const { article, warnings } = await ArticleCreator.createOne({
      title: extracted.title,
      content: extracted.content,
      url,
      domain,
      userId: user.id,
      collectionId: validCollectionId,
      type: 'markdown',
    });

    console.log('[Import] Article created', { 
      articleId: article.id,
      warnings: warnings.length > 0 ? warnings : undefined,
    });

    // 3. 刷新缓存
    revalidatePath('/');

    // 4. 调度后台索引（不阻塞）
    const jobId = await IndexingScheduler.schedule([article.id], user.id, 'URL');
    console.log('[Import] Indexing scheduled', { jobId });

    // 5. 返回结果
    const { body: articleBody, ...rest } = article;
    return {
      success: true,
      data: {
        ...rest,
        content: articleBody?.content,
        jobId, // 返回jobId供前端查询进度
        warnings: warnings.length > 0 ? warnings : undefined,
      }
    };
  } catch (error) {
    console.error('[Import] URL import failed', {
      url,
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * 导入文件 - 保持简洁
 */
export async function importFile(filePath: string, originalName: string, fileType?: string) {
  const user = await requireUser();

  console.log('[Import] Starting file import', { 
    filePath, 
    originalName, 
    fileType,
    userId: user.id,
  });

  if (!filePath || !originalName) {
    throw new Error('Missing filePath or originalName');
  }

  try {
    const result = await importFileForUser({ 
      userId: user.id, 
      filePath, 
      originalName, 
      fileType 
    });

    console.log('[Import] File import completed', {
      collectionId: result.data.collection.id,
      articlesCount: result.data.articlesCount,
      totalChapters: result.data.totalChapters,
    });

    return result;
  } catch (error) {
    console.error('[Import] File import failed', {
      filePath,
      originalName,
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
