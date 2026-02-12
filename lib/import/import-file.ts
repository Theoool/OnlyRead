import { prisma } from '@/lib/infrastructure/database/prisma'
import { IndexingService } from '@/lib/core/indexing/service'
import { getServiceClient } from '@/lib/supabase/server'
import { FileParser } from '@/lib/file-parser'
import { ForbiddenError } from '@/lib/infrastructure/error'
import { revalidatePath } from 'next/cache'
import { User } from '@/lib/store/useAuthStore'
// 新增：导入服务端处理器和类型定义
import { processFileOnServer } from '@/lib/server/file-processor-server'
import { ProcessedBook } from '@/lib/integration/file-processor-bridge'

export async function importFileForUser(params: {
  userId: string
  filePath: string
  originalName: string
  fileType?: string
}) {
  const { userId, filePath, originalName } = params
  
  // 获取用户完整信息
  const userRecord = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      avatarUrl: true,
      subscriptionType: true
    }
  })

  const user: User | null = userRecord ? {
    id: userRecord.id,
    email: userRecord.email,
    fullName: userRecord.fullName || undefined,
    avatarUrl: userRecord.avatarUrl || undefined,
    subscriptionType: userRecord.subscriptionType as 'free' | 'premium'
  } : null

  if (!filePath || !originalName) {
    throw new Error('Missing filePath or originalName')
  }

  if (!filePath.startsWith(`${userId}/`)) {
    throw new ForbiddenError('Invalid filePath')
  }

  const supabase = await getServiceClient()

  const { data: fileData, error: downloadError } = await supabase.storage.from('files').download(filePath)

  if (downloadError || !fileData) {
    throw new Error('Failed to download file from storage')
  }

  const buffer = Buffer.from(await fileData.arrayBuffer())
  
  // 使用服务端处理器处理文件
  let parsedBook: ProcessedBook
  
  const isEpub = originalName.toLowerCase().endsWith('.epub')
  const isPdf = originalName.toLowerCase().endsWith('.pdf')
  const isMd = originalName.toLowerCase().endsWith('.md')
  const isTxt = originalName.toLowerCase().endsWith('.txt')

  // 使用服务端专用处理器
  parsedBook = await processFileOnServer(buffer, originalName)

  const safeTitle = (parsedBook.title || originalName || 'UNK📕').replace(/\0/g, '')
  const safeDesc = (parsedBook.description || parsedBook.metadata?.description || '').replace(/\0/g, '')

  const collection = await prisma.collection.create({
    data: {
      title: safeTitle,
      description: safeDesc,
      type: isEpub ? 'BOOK' : 'DOCUMENT',
      userId,
    },
  })

  if (!parsedBook.chapters || parsedBook.chapters.length === 0) {
    await prisma.collection.delete({ where: { id: collection.id } })
    throw new Error('No chapters found in file')
  }

  const articlesData: any[] = []
  const now = new Date()

  parsedBook.chapters.forEach((chapter: any, index: number) => {
    const safeContent = (chapter.content || '').replace(/\0/g, '')
    const safeChapterTitle = (chapter.title || 'Untitled Chapter')
      .replace(/\0/g, '')
      .substring(0, 1000)

    // 处理过长的内容 - 更严格的限制
    let processedContent = safeContent;
    const MAX_CONTENT_LENGTH = 30000; // 降低到30KB
    
    if (processedContent.length > MAX_CONTENT_LENGTH) {
      processedContent = processedContent.substring(0, MAX_CONTENT_LENGTH) + '\n\n... (内容已截断)';
      console.warn(`章节内容过长，已截断到${MAX_CONTENT_LENGTH}字符: ${safeChapterTitle}`);
    }
    
    // 进一步清理内容
    processedContent = processedContent
      .replace(/!\[.*?\]\(.*?\)/g, '') // 移除图片引用
      .replace(/\[.*?\]\(.*?\)/g, '$1') // 简化链接
      .replace(/\n{3,}/g, '\n\n') // 限制连续换行
      .replace(/^\s+|\s+$/g, '') // 去除首尾空白
      .trim();

    const totalBlocks = processedContent.split(/\n\s*\n/).filter(Boolean).length
    const totalReadingTime = chapter.readingTime || Math.ceil(processedContent.length / 400)

    articlesData.push({
      title: safeChapterTitle,
      content: processedContent, // 使用处理后的内容
      userId,
      collectionId: collection.id,
      order: index,
      type: 'markdown',
      domain: 'local-file',
      createdAt: now,
      updatedAt: now,
      progress: 0,
      currentPosition: 0,
      totalBlocks: totalBlocks || 0,
      completedBlocks: 0,
      totalReadingTime: totalReadingTime || 0,
     
    })
  })

  let insertedCount = 0
  const errors: any[] = []

  if (articlesData.length > 0) {
    const BATCH_SIZE = 3; // 降低批次大小
      
    console.log(`开始插入${articlesData.length}篇文章，分${Math.ceil(articlesData.length/BATCH_SIZE)}批处理`);
      
    for (let i = 0; i < articlesData.length; i += BATCH_SIZE) {
      const batch = articlesData.slice(i, i + BATCH_SIZE);
      console.log(`处理第${Math.floor(i/BATCH_SIZE)+1}批，包含${batch.length}篇文章`);
        
      try {
        // 在事务前先验证数据
        for (const articleData of batch) {
          if (!articleData.content) {
            console.warn('发现空内容文章:', articleData.title);
            continue;
          }
          if (articleData.content.length > 35000) {
            console.warn(`文章内容仍然过长(${articleData.content.length}字符):`, articleData.title);
          }
        }
          
        const createdArticles = await prisma.$transaction(
          batch.map((articleData: any) => {
            const { content, ...metaData } = articleData;
            console.log(`创建文章: ${metaData.title}, 内容长度: ${content?.length || 0}`);
              
            return prisma.article.create({
              data: {
                ...metaData,
                body: {
                  create: {
                    content: content || '',
                    markdown: content || '',
                  },
                },
              },
              include: {
                body: true
              }
            });
          }),
        );

        insertedCount += batch.length

        try {
          let job;
          try {
            job = await prisma.job.create({
              data: {
                userId,
                type: 'GENERATE_EMBEDDING',
                status: 'PROCESSING',
                payload: { articleIds: createdArticles.map((a) => a.id) },
                progress: 0,
              },
            });
          } catch (jobErr) {
            console.error('Failed to create indexing job', jobErr);
          }

          let completed = 0;
          // Process sequentially to be safe, or Promise.all if we trust the API limit
          for (const article of createdArticles) {
            try {
              await IndexingService.processArticle(article.id, userId, user);
              completed++;

              if (job && createdArticles.length > 0 && completed % 2 === 0) {
                // Update less frequently
                await prisma.job
                  .update({
                    where: { id: job.id },
                    data: { progress: Math.floor((completed / createdArticles.length) * 100) },
                  })
                  .catch(() => { });
              }
            } catch (idxErr) {
              console.error(`Failed to index article ${article.id}`, idxErr);
            }
          }

          if (job) {
            await prisma.job
              .update({
                where: { id: job.id },
                data: {
                  status: 'COMPLETED',
                  progress: 100,
                  result: { processed: completed, total: createdArticles.length },
                },
              })
              .catch(() => { });
          }
        } catch (e) {
          console.error('Batch indexing failed', e);
        }
      } catch (e: any) {
        errors.push({
          batch: i / BATCH_SIZE,
          code: e.code,
          message: e.message || String(e),
          meta: e.meta,
        })
      }
    }
  }

  if (articlesData.length > 0 && insertedCount === 0) {
    console.error('导入失败详情:', {
      articlesDataLength: articlesData.length,
      insertedCount: insertedCount,
      collectionId: collection.id,
      errors: errors
    }); 
    await prisma.collection.delete({ where: { id: collection.id } })
    throw new Error('Failed to import any chapters')
  }

  let cleanupFailed = false
  try {
    await supabase.storage.from('files').remove([filePath])
  } catch {
    cleanupFailed = true
  }

  revalidatePath('/')
  revalidatePath('/collections')

  return {
    success: true,
    data: {
      collection,
      articlesCount: insertedCount,
      totalChapters: articlesData.length,
      errors: errors.length > 0 ? errors : undefined,
      warnings: cleanupFailed
        ? [{ id: filePath, error: 'Failed to cleanup uploaded file' }].concat(parsedBook.failedChapters || [])
        : parsedBook.failedChapters?.length
          ? parsedBook.failedChapters
          : undefined,
      // 新增性能和元数据信息
      metadata: {
        ...parsedBook.metadata,
        processingArchitecture: parsedBook.metadata?.processedBy || 'unknown',
        performance: parsedBook.performance
      }
    },
  }
}
