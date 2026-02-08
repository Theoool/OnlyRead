import { prisma } from '@/lib/infrastructure/database/prisma'
import { IndexingService } from '@/lib/core/indexing/service'
import { getServiceClient } from '@/lib/supabase/server'
import { FileParser } from '@/lib/file-parser'
import { ForbiddenError } from '@/lib/infrastructure/error'
import { revalidatePath } from 'next/cache'

export async function importFileForUser(params: {
  userId: string
  filePath: string
  originalName: string
  fileType?: string
}) {
  const { userId, filePath, originalName } = params

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
  const parser = new FileParser()
  let parsedBook: any

  const isEpub = originalName.toLowerCase().endsWith('.epub')
  const isPdf = originalName.toLowerCase().endsWith('.pdf')
  const isMd = originalName.toLowerCase().endsWith('.md')
  const isTxt = originalName.toLowerCase().endsWith('.txt')

  if (isEpub) {
    parsedBook = await parser.parseEpub(buffer)
  } else if (isPdf) {
    parsedBook = await parser.parsePdf(buffer)
  } else if (isMd || isTxt) {
    const text = buffer.toString('utf-8')
    parsedBook = {
      title: originalName.replace(/\.[^/.]+$/, ''),
      description: '',
      chapters: [
        {
          title: originalName,
          content: text,
          order: 0,
        },
      ],
    }
  } else {
    throw new Error('Unsupported file format')
  }

  const safeTitle = (parsedBook.title || originalName || 'UNK📕').replace(/\0/g, '')
  const safeDesc = (parsedBook.description || '').replace(/\0/g, '')

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

    const totalBlocks = safeContent.split(/\n\s*\n/).filter(Boolean).length
    const totalReadingTime = Math.ceil(safeContent.length / 400)

    articlesData.push({
      title: safeChapterTitle,
      content: safeContent,
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
    const BATCH_SIZE = 5

    for (let i = 0; i < articlesData.length; i += BATCH_SIZE) {
      const batch = articlesData.slice(i, i + BATCH_SIZE)
      try {
        const createdArticles = await prisma.$transaction(
          batch.map((articleData: any) => {
            const { content, ...metaData } = articleData
            return prisma.article.create({
              data: {
                ...metaData,
                body: {
                  create: {
                    content,
                    markdown: content,
                  },
                },
              },
            })
          }),
        )

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
              await IndexingService.processArticle(article.id, userId);
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
    },
  }
}
