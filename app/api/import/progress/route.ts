/**
 * 文件导入进度查询 API
 * 用于查询导入任务的实时进度
 */

import { apiHandler, createSuccessResponse } from '@/lib/infrastructure/error/response';
import { BadRequestError } from '@/lib/infrastructure/error';
import { requireUserFromHeader } from '@/lib/supabase/user';
import { prisma } from '@/lib/infrastructure/database/prisma';

export const GET = apiHandler(async (req: Request) => {
  const user = await requireUserFromHeader(req);
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get('jobId');

  if (!jobId) {
    throw new BadRequestError('缺少必需参数: jobId');
  }

  // 查询 Job 状态
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      type: true,
      status: true,
      progress: true,
      result: true,
      payload: true,
      createdAt: true,
      updatedAt: true,
      userId: true,
    },
  });

  if (!job) {
    throw new BadRequestError('任务不存在');
  }

  // 验证权限
  if (job.userId !== user.id) {
    throw new BadRequestError('无权访问此任务');
  }

  // 计算详细进度信息
  const progressInfo = {
    jobId: job.id,
    type: job.type,
    status: job.status,
    progress: job.progress,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    duration: Date.now() - new Date(job.createdAt).getTime(),
    
    // 从 payload 和 result 中提取详细信息
    details: {
      totalArticles: (job.payload as any)?.articleIds?.length || 0,
      processedArticles: (job.result as any)?.processed || 0,
      failedArticles: (job.result as any)?.failed || 0,
      source: (job.payload as any)?.source || 'unknown',
    },

    // 状态描述
    message: getStatusMessage(job.status, job.progress, job.result),
  };

  return createSuccessResponse(progressInfo);
});

/**
 * 获取状态描述信息
 */
function getStatusMessage(
  status: string,
  progress: number,
  result: any
): string {
  switch (status) {
    case 'PENDING':
      return '任务等待中...';
    case 'PROCESSING':
      return `正在处理... (${progress}%)`;
    case 'COMPLETED':
      const processed = result?.processed || 0;
      const failed = result?.failed || 0;
      const total = result?.total || 0;
      return `处理完成！成功: ${processed}/${total}, 失败: ${failed}`;
    case 'FAILED':
      const error = result?.error || '未知错误';
      return `处理失败: ${error}`;
    default:
      return '未知状态';
  }
}

