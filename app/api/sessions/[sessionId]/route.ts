import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUserFromHeader } from '@/lib/supabase/user';
import { createErrorResponse } from '@/lib/infrastructure/error/response';
import { SessionManager } from '@/lib/core/sessions/manager';

const UpdateSessionSchema = z.object({
  title: z.string().optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED', 'COMPLETED']).optional(),
  mode: z.enum(['QA', 'TUTOR', 'COPILOT']).optional(),
  context: z.any().optional(),
});

/**
 * GET /api/sessions/[sessionId]
 * 获取单个会话详情
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const user = await requireUserFromHeader(req);
    const { sessionId } = await params;

    const session = await SessionManager.getSession(sessionId, user.id);
    
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json(session);
  } catch (error) {
    console.error('[Session API] Get error:', error);
    return createErrorResponse(error);
  }
}

/**
 * PATCH /api/sessions/[sessionId]
 * 更新会话
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const user = await requireUserFromHeader(req);
    const { sessionId } = await params;
    const body = await req.json();
    const updates = UpdateSessionSchema.parse(body);

    await SessionManager.updateSession(sessionId, user.id, updates);
    
    const session = await SessionManager.getSession(sessionId, user.id);
    return NextResponse.json(session);
  } catch (error) {
    console.error('[Session API] Update error:', error);
    return createErrorResponse(error);
  }
}

/**
 * DELETE /api/sessions/[sessionId]
 * 删除会话
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const user = await requireUserFromHeader(req);
    const { sessionId } = await params;

    const result = await SessionManager.deleteSession(sessionId, user.id);
    
    return NextResponse.json({ 
      success: true, 
      deletedCount: result.deletedCount 
    });
  } catch (error) {
    console.error('[Session API] Delete error:', error);
    return createErrorResponse(error);
  }
}

