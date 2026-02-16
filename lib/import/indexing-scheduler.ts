/**
 * 索引调度器 - 统一的后台索引处理
 */

import { prisma } from '@/lib/infrastructure/database/prisma';
import { IndexingService } from '@/lib/core/indexing/service';

export type IndexingSource = 'URL' | 'FILE';

export interface IndexingJob {
  id: string;
  articleIds: string[];
  userId: string;
  source: IndexingSource;
}

export interface IndexingResult {
  jobId: string;
  processed: number;
  failed: number;
  total: number;
}

/**
 * 索引调度器类
 */
export class IndexingScheduler {
  private static readonly UPDATE_INTERVAL = 5; // 每5篇更新一次进度

  /**
   * 调度后台索引任务（异步，不阻塞）
   */
  static async schedule(
    articleIds: string[],
    userId: string,
    source: IndexingSource
  ): Promise<string> {
    if (articleIds.length === 0) {
      throw new Error('No articles to index');
    }

    // 根据来源选择正确的 Job 类型
    const jobType = source === 'FILE' ? 'IMPORT_FILE' : 'GENERATE_EMBEDDING';

    // 创建Job记录
    const job = await prisma.job.create({
      data: {
        userId,
        type: jobType,
        status: 'PENDING',
        payload: { articleIds, source },
        progress: 0,
      },
    });

    // 异步执行（不等待）
    this.executeInBackground(job.id, articleIds, userId).catch((err) => {
      console.error(`[IndexingScheduler] Background execution failed for job ${job.id}:`, err);
    });

    return job.id;
  }

  /**
   * 后台执行索引任务
   */
  private static async executeInBackground(
    jobId: string,
    articleIds: string[],
    userId: string
  ): Promise<void> {
    const startTime = Date.now();
    let processed = 0;
    let failed = 0;

    try {
      // 更新状态为处理中
      await this.updateJobStatus(jobId, 'PROCESSING', 0);

      // 逐个处理文章
      for (let i = 0; i < articleIds.length; i++) {
        const articleId = articleIds[i];

        try {
          await IndexingService.processArticle(articleId, userId);
          processed++;

          // 定期更新进度
          if ((i + 1) % this.UPDATE_INTERVAL === 0 || i === articleIds.length - 1) {
            const progress = Math.floor(((i + 1) / articleIds.length) * 100);
            await this.updateJobProgress(jobId, progress);
          }
        } catch (err) {
          failed++;
          console.error(`[IndexingScheduler] Failed to index article ${articleId}:`, err);
        }
      }

      // 完成
      const duration = Date.now() - startTime;
      await this.updateJobStatus(jobId, 'COMPLETED', 100, {
        processed,
        failed,
        total: articleIds.length,
        duration,
      });

      console.log(
        `[IndexingScheduler] Job ${jobId} completed: ${processed}/${articleIds.length} succeeded, ${failed} failed, took ${duration}ms`
      );
    } catch (err) {
      // 任务失败
      await this.updateJobStatus(jobId, 'FAILED', undefined, {
        error: err instanceof Error ? err.message : String(err),
        processed,
        failed,
        total: articleIds.length,
      });

      throw err;
    }
  }

  /**
   * 更新Job状态
   */
  private static async updateJobStatus(
    jobId: string,
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED',
    progress?: number,
    result?: any
  ): Promise<void> {
    try {
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status,
          ...(progress !== undefined && { progress }),
          ...(result && { result }),
        },
      });
    } catch (err) {
      console.error(`[IndexingScheduler] Failed to update job ${jobId}:`, err);
    }
  }

  /**
   * 更新Job进度
   */
  private static async updateJobProgress(jobId: string, progress: number): Promise<void> {
    try {
      await prisma.job.update({
        where: { id: jobId },
        data: { progress },
      });
    } catch (err) {
      // 忽略进度更新失败
    }
  }

  /**
   * 获取Job状态
   */
  static async getJobStatus(jobId: string): Promise<any> {
    return prisma.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        status: true,
        progress: true,
        result: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * 取消Job
   */
  static async cancelJob(jobId: string): Promise<void> {
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'FAILED',
        result: { error: 'Cancelled by user' },
      },
    });
  }
}

