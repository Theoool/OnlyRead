import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUserFromHeader } from '@/lib/supabase/user';
import { createErrorResponse } from '@/lib/infrastructure/error/response';
import { SessionManager } from '@/lib/core/sessions/manager';

const CreateSessionSchema = z.object({
  type: z.enum(['LEARNING', 'COPILOT', 'QA']).default('COPILOT'),
  mode: z.enum(['QA', 'TUTOR', 'COPILOT']).default('TUTOR'),
  title: z.string().optional(),
  context: z.object({
    articleIds: z.array(z.string()).optional(),
    collectionId: z.string().optional(),
    currentTopic: z.string().optional(),
    masteryLevel: z.number().optional(),
  }).optional(),
});

const ListSessionsSchema = z.object({
  type: z.enum(['LEARNING', 'COPILOT', 'QA']).optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED', 'COMPLETED']).optional(),
});

/**
 * GET /api/sessions
 * 列出用户的所有会话
 */
export async function GET(req: Request) {
  try {
    const user = await requireUserFromHeader(req);
    const { searchParams } = new URL(req.url);
    
    const filters = ListSessionsSchema.parse({
      type: searchParams.get('type') || undefined,
      status: searchParams.get('status') || undefined,
    });

    const sessions = await SessionManager.listSessions(user.id, filters);
    return NextResponse.json(sessions);
  } catch (error) {
    console.error('[Sessions API] List error:', error);
    return createErrorResponse(error);
  }
}

/**
 * POST /api/sessions
 * 创建新会话
 */
export async function POST(req: Request) {
  try {
    const user = await requireUserFromHeader(req);
    const body = await req.json();
    const data = CreateSessionSchema.parse(body);

    const session = await SessionManager.createSession({
      userId: user.id,
      type: data.type,
      mode: data.mode,
      title: data.title,
      context: data.context,
    });

    return NextResponse.json(session);
  } catch (error) {
    console.error('[Sessions API] Create error:', error);
    return createErrorResponse(error);
  }
}

