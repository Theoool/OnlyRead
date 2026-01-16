import { NextResponse } from 'next/server';
import { getOrCreateUser } from '@/lib/supabase/user';
import { apiHandler, createSuccessResponse } from '@/lib/infrastructure/api/response';
import { ConceptsRepository } from '@/lib/core/learning/concepts.repository';
import { UnauthorizedError, ValidationError } from '@/lib/infrastructure/error';

// Helper to get authenticated user or throw
async function requireUser() {
  const user = await getOrCreateUser();
  if (!user) {
    throw new UnauthorizedError();
  }
  return user;
}

/**
 * GET /api/concepts/related
 *
 * 查找语义相似的概念
 *
 * Query Parameters:
 * - text: 要搜索的文本
 * - limit: 返回结果数量 (默认 5, 最大 20)
 * - threshold: 相似度阈值 (默认 0.7, 范围 0-1)
 *
 * Example:
 * GET /api/concepts/related?text=机器学习&limit=5&threshold=0.7
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

  if (threshold < 0 || threshold > 1) {
    throw new ValidationError('threshold 必须在 0-1 之间');
  }

  console.log(`🔍 Finding related concepts for user ${user.id}, text: "${text.substring(0, 50)}..."`);

  const related = await ConceptsRepository.findRelated(user.id, text, limit, threshold);

  console.log(`✅ Found ${related.length} related concepts`);

  return createSuccessResponse({ related });
});
