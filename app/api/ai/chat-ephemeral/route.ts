import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { requireUserFromHeader } from '@/lib/supabase/user';
import { createErrorResponse } from '@/lib/infrastructure/error/response';

const ChatRequestSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  context: z.string().optional(),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system', 'USER', 'ASSISTANT', 'SYSTEM']).transform(val => val.toLowerCase()),
    content: z.string()
  })).optional()
});

export const runtime = 'nodejs';

/**
 * POST /api/ai/chat-ephemeral
 * 临时聊天端点 - 不保存到数据库，直接使用文章内容作为上下文
 */
export async function POST(req: Request) {
  try {
    // 验证用户
    const user = await requireUserFromHeader(req);

    // 解析请求
    const body = await req.json();
    const { message, context, history } = ChatRequestSchema.parse(body);

    // 创建 LLM
    const llm = new ChatOpenAI({
      modelName: process.env.AI_MODEL_NAME || 'gpt-4o-mini',
      temperature: 0.7,
      streaming: true,
      apiKey: process.env.OPENAI_API_KEY,
      configuration: { baseURL: process.env.OPENAI_BASE_URL },
    });

    // 构建消息历史
    const messages: any[] = [];

    // 系统提示词
    const systemPrompt = `你是一个专业的阅读助手，帮助用户理解和分析文章内容。

${context ? `\n当前文章上下文：\n${context}\n` : ''}

请基于上述文章内容回答用户的问题。如果问题与文章内容相关，请引用具体段落。保持回答简洁、准确、有帮助。`;

    messages.push(new SystemMessage(systemPrompt));

    // 添加历史对话
    if (history && history.length > 0) {
      // 只保留最近 10 轮对话
      const recentHistory = history.slice(-20);
      recentHistory.forEach(msg => {
        if (msg.role === 'user') {
          messages.push(new HumanMessage(msg.content));
        } else if (msg.role === 'assistant') {
          messages.push(new AIMessage(msg.content));
        }
      });
    }

    // 添加当前用户消息
    messages.push(new HumanMessage(message));

    // 创建流式响应
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        try {
          const streamResponse = await llm.stream(messages);

          for await (const chunk of streamResponse) {
            const text = chunk.content;
            if (text) {
              const data = JSON.stringify({ type: 'delta', text });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
          }

          // 发送完成信号
          const doneData = JSON.stringify({ type: 'done' });
          controller.enqueue(encoder.encode(`data: ${doneData}\n\n`));
          controller.close();

        } catch (error) {
          console.error('[Chat Ephemeral] Error:', error);
          const errorData = JSON.stringify({ 
            type: 'error', 
            message: error instanceof Error ? error.message : 'Unknown error' 
          });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          controller.close();
        }
      }
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });

  } catch (error) {
    console.error('[Chat Ephemeral API] Error:', error);
    return createErrorResponse(error);
  }
}


