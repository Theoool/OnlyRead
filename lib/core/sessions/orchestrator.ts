import { randomUUID } from 'crypto';
import { HumanMessage, AIMessage, SystemMessage, BaseMessage } from '@langchain/core/messages';
import { prisma } from '@/lib/infrastructure/database/prisma';
import { unifiedGraph } from '@/lib/core/ai/graph/workflow';
import { runWithAiStreamContext } from '@/lib/core/ai/streaming/context';
import { encodeSseEvent } from '@/lib/core/ai/streaming/sse';
import { MessageRepository } from './message.repository';
import { SessionManager } from './manager';
import { SummaryService } from '@/lib/core/learning/summary.service';
import { ModeType } from '@/lib/generated/prisma';

export interface ChatInput {
  sessionId: string;
  userId: string;
  message: string;
  mode: ModeType;
  context?: {
    articleIds?: string[];
    collectionId?: string;
    selection?: string;
    currentContent?: string;
    currentTopic?: string;
    masteryLevel?: number;
  };
  uiIntent?: string;
}

export interface StreamHandlers {
  onMeta?: (data: any) => void;
  onStep?: (data: any) => void;
  onSources?: (data: any) => void;
  onDelta?: (data: any) => void;
  onFinal?: (data: any) => void;
  onError?: (data: any) => void;
  onDone?: (data: any) => void;
}

/**
 * ChatOrchestrator - AI 聊天编排器
 * 负责协调整个 AI 工作流，包括消息持久化、流式响应、摘要生成
 */
export class ChatOrchestrator {
  /**
   * 执行 AI 工作流并返回流式响应
   */
  static async execute(input: ChatInput): Promise<ReadableStream<Uint8Array>> {
    return new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const traceId = randomUUID();

        const send = (event: string, data: unknown) => {
          try {
            controller.enqueue(encoder.encode(encodeSseEvent(event, data)));
          } catch (err) {
            console.error('[Orchestrator] Failed to send SSE event:', err);
          }
        };

        const abort = () => {
          try {
            send('done', { traceId, aborted: true });
          } finally {
            controller.close();
          }
        };

        try {
          // 1. 验证会话存在
          const session = await SessionManager.getOrCreateSession(input.sessionId, input.userId);
          
          // 2. 更新活动时间
          await SessionManager.updateActivity(input.sessionId);

          // 3. 加载历史消息（带滑动窗口）
          const history = await ChatOrchestrator.loadHistory(input.sessionId);

          // 4. 保存用户消息
          await MessageRepository.create({
            sessionId: input.sessionId,
            role: 'USER',
            content: input.message,
          });

          // 5. 发送元数据
          send('meta', { 
            traceId, 
            mode: input.mode, 
            sessionId: input.sessionId 
          });

          // 6. 创建流式事件发射器
          const emitter = {
            emit: (evt: any) => {
              send(evt.type, { ...evt.data, traceId });
            },
          };

          // 7. 执行 AI Graph
          const finalState: any = await runWithAiStreamContext({ emitter, traceId }, async () => {
            return unifiedGraph.invoke({
              messages: history,
              userMessage: input.message,
              userId: input.userId,
              mode: input.mode,
              context: {
                selection: input.context?.selection,
                currentContent: input.context?.currentContent,
              },
              articleIds: input.context?.articleIds || [],
              collectionId: input.context?.collectionId,
              currentTopic: input.context?.currentTopic || 'General',
              masteryLevel: input.context?.masteryLevel ?? 0,
              uiIntent: input.uiIntent,
            } as any);
          });

          const finalResponse: any = finalState?.finalResponse;
          
          if (!finalResponse) {
            send('error', { message: 'No finalResponse from AI graph' });
            send('done', { traceId });
            controller.close();
            return;
          }

          // 8. 保存 AI 响应
          const content = ChatOrchestrator.extractContent(finalResponse);
          await MessageRepository.create({
            sessionId: input.sessionId,
            role: 'ASSISTANT',
            content,
            ui: finalResponse.ui,
            sources: finalResponse.sources || [],
          });

          // 9. 触发摘要生成（异步，不阻塞）
          ChatOrchestrator.triggerSummaryGeneration(input.sessionId).catch(err => {
            console.error('[Orchestrator] Summary generation failed:', err);
          });

          // 10. 发送最终响应
          send('final', finalResponse);
          send('done', { traceId });
          controller.close();

        } catch (error) {
          console.error('[Orchestrator] Execution error:', error);
          send('error', { 
            message: 'Execution failed', 
            detail: error instanceof Error ? error.message : String(error) 
          });
          send('done', { traceId });
          controller.close();
        }
      },
    });
  }

  /**
   * 加载历史消息（带滑动窗口和摘要）
   */
  private static async loadHistory(sessionId: string): Promise<BaseMessage[]> {
    const session = await prisma.learningSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: -20, // 最近 20 条消息
        },
      },
    });

    const messages: BaseMessage[] = [];

    // 如果有摘要，添加为系统消息
    if (session?.summary) {
      messages.push(new SystemMessage(`Previous conversation summary: ${session.summary}`));
    }

    // 添加历史消息
    session?.messages.forEach(m => {
      const content = m.content || '';
      if (m.role === 'USER') {
        messages.push(new HumanMessage(content));
      } else if (m.role === 'ASSISTANT') {
        messages.push(new AIMessage(content));
      } else if (m.role === 'SYSTEM') {
        messages.push(new SystemMessage(content));
      }
    });

    return messages;
  }

  /**
   * 从 AI 响应中提取文本内容
   */
  private static extractContent(response: any): string {
    if (!response) return '';

    const ui = response.ui;
    if (!ui) return '';

    if (ui.type === 'explanation') {
      return String(ui.content || '');
    }
    if (ui.type === 'quiz') {
      return String(ui.question || '');
    }
    if (ui.type === 'code') {
      return String(ui.description || '');
    }
    if (ui.type === 'summary') {
      return String(ui.content || '');
    }

    // 默认返回 JSON 字符串
    return JSON.stringify(ui);
  }

  /**
   * 触发摘要生成（异步，不阻塞响应）
   */
  private static async triggerSummaryGeneration(sessionId: string): Promise<void> {
    try {
      const messageCount = await MessageRepository.countBySession(sessionId);
      const session = await prisma.learningSession.findUnique({
        where: { id: sessionId },
        select: { summary: true },
      });

      const shouldGenerate = SummaryService.shouldGenerateSummary(
        messageCount,
        !!session?.summary
      );

      if (shouldGenerate) {
        // 异步生成，不等待
        SummaryService.generateAndSaveSummary(sessionId).catch(err => {
          console.error('[Orchestrator] Background summary generation failed:', err);
        });
      }
    } catch (error) {
      console.error('[Orchestrator] Failed to check summary generation:', error);
    }
  }

  /**
   * 处理 SSE 流（用于客户端）
   */
  static async processStream(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    decoder: TextDecoder,
    handlers: StreamHandlers
  ): Promise<void> {
    let buffer = '';

    const feed = (text: string) => {
      buffer += text;
      while (true) {
        const splitIndex = buffer.indexOf('\n\n');
        if (splitIndex === -1) break;

        const frame = buffer.slice(0, splitIndex);
        buffer = buffer.slice(splitIndex + 2);

        const lines = frame.split(/\r?\n/);
        let event = 'message';
        const dataLines: string[] = [];

        for (const line of lines) {
          if (line.startsWith('event:')) {
            event = line.slice('event:'.length).trim();
          } else if (line.startsWith('data:')) {
            const v = line.slice('data:'.length);
            dataLines.push(v.startsWith(' ') ? v.slice(1) : v);
          }
        }

        if (dataLines.length === 0) continue;

        const raw = dataLines.join('\n');
        try {
          const parsed = JSON.parse(raw);
          ChatOrchestrator.handleSSEEvent(event, parsed, handlers);
        } catch {
          ChatOrchestrator.handleSSEEvent(event, raw, handlers);
        }
      }
    };

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          feed(decoder.decode(value, { stream: true }));
        }
      }
    } finally {
      try {
        reader.releaseLock();
      } catch {}
    }
  }

  /**
   * 处理 SSE 事件
   */
  private static handleSSEEvent(event: string, data: any, handlers: StreamHandlers): void {
    switch (event) {
      case 'meta':
        handlers.onMeta?.(data);
        break;
      case 'step':
        handlers.onStep?.(data);
        break;
      case 'sources':
        handlers.onSources?.(data);
        break;
      case 'delta':
        handlers.onDelta?.(data);
        break;
      case 'final':
        handlers.onFinal?.(data);
        break;
      case 'error':
        handlers.onError?.(data);
        break;
      case 'done':
        handlers.onDone?.(data);
        break;
    }
  }
}

