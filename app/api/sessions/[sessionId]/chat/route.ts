import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUserFromHeader } from '@/lib/supabase/user';
import { createErrorResponse } from '@/lib/infrastructure/error/response';
import { ChatOrchestrator } from '@/lib/core/sessions/orchestrator';
import { SessionManager } from '@/lib/core/sessions/manager';

const ChatRequestSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  uiIntent: z.string().optional(),
});

export const runtime = 'nodejs';

/**
 * POST /api/sessions/[sessionId]/chat
 * 统一的聊天 API 端点
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    // 1. 验证用户
    const user = await requireUserFromHeader(req);
    const { sessionId } = await params;

    // 2. 解析请求
    const body = await req.json();
    const { message, uiIntent } = ChatRequestSchema.parse(body);

    // 3. 获取会话信息
    const session = await SessionManager.getOrCreateSession(sessionId, user.id);

    // 4. 执行 AI 工作流（返回流式响应）
    const stream = await ChatOrchestrator.execute({
      sessionId: session.id,
      userId: user.id,
      message,
      mode: session.mode,
      context: {
        ...(session.context as any),
      },
      uiIntent,
    });

    // 5. 返回 SSE 流
    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[Chat API] Error:', error);
    return createErrorResponse(error);
  }
}

