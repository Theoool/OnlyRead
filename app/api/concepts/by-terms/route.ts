import { NextResponse } from 'next/server';
import { requireUserFromHeader } from '@/lib/supabase/user';
import { apiHandler, createSuccessResponse } from '@/lib/infrastructure/error/response';
import { prisma } from '@/lib/infrastructure/database/prisma';

/**
 * POST - 根据 term 列表批量获取 concepts
 * 用于在阅读页面批量检查哪些 concept 已保存
 */
export const POST = apiHandler(async (req: Request) => {
  const user = await requireUserFromHeader(req);
  const { terms } = await req.json();

  if (!Array.isArray(terms) || terms.length === 0) {
    return createSuccessResponse({ concepts: [] });
  }

  // 限制最大查询数量
  const limitedTerms = terms.slice(0, 50);

  // 使用 Prisma 查询匹配的 concepts
  const concepts = await prisma.concept.findMany({
    where: {
      userId: user.id,
      deletedAt: null,
      term: {
        in: limitedTerms,
      },
    },
    select: {
      id: true,
      term: true,
      myDefinition: true,
      myExample: true,
      myConnection: true,
      confidence: true,
      aiDefinition: true,
      aiExample: true,
      aiRelatedConcepts: true,
      sourceArticleId: true,
      isAiCollected: true,
      createdAt: true,
      updatedAt: true,
      lastReviewedAt: true,
      reviewCount: true,
      nextReviewDate: true,
      easeFactor: true,
      interval: true,
      tags: true,
    },
  });

  return createSuccessResponse({ concepts });
});

/**
 * GET - 检查单个 term 是否已存在
 */
export const GET = apiHandler(async (req: Request) => {
  const user = await requireUserFromHeader(req);
  const { searchParams } = new URL(req.url);
  const term = searchParams.get('term');

  if (!term) {
    return createSuccessResponse({ exists: false });
  }

  const concept = await prisma.concept.findFirst({
    where: {
      userId: user.id,
      deletedAt: null,
      term: term,
    },
    select: {
      id: true,
      term: true,
      myDefinition: true,
      confidence: true,
    },
  });

  return createSuccessResponse({
    exists: !!concept,
    concept,
  });
});
