import { NextResponse } from 'next/server';
import { getOrCreateUser } from '@/lib/supabase/user';
import { apiHandler, createSuccessResponse } from '@/lib/infrastructure/error/response';
import { ArticlesRepository } from '@/lib/core/reading/articles.repository';
import { UnauthorizedError, ValidationError } from '@/lib/infrastructure/error';
import { z } from 'zod';

// Helper to get authenticated user or throw
async function requireUser() {
  const user = await getOrCreateUser();
  if (!user) {
    throw new UnauthorizedError();
  }
  return user;
}

/**
 * GET /api/articles/search
 *
 * 语义搜索文章
 *
 * Query Parameters:
 * - text: 要搜索的文本
 * - limit: 返回结果数量 (默认 5, 最大 20)
 * - threshold: 相似度阈值 (默认 0.7, 范围 0-1)
 */
export const GET = apiHandler(async (req: Request) => {
  const user = await requireUser();
  const { searchParams } = new URL(req.url);

  // 解析查询参数
  const text = searchParams.get('text') || '';
  const limit = Math.min(Number(searchParams.get('limit') || '5'), 20);
  const threshold = Number(searchParams.get('threshold') || '0.7');

  // 验证必需参数
  if (!text || text.trim().length === 0) {
    throw new ValidationError('text 参数不能为空');
  }

  console.log(`🔍 Searching articles for user ${user.id}, text: "${text.substring(0, 50)}..."`);

  const results = await ArticlesRepository.findRelated(user.id, text, limit, threshold);

  console.log(`✅ Found ${results.length} related articles`);

  return createSuccessResponse({ articles: results });
});
