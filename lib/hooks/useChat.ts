import { useState, useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ChatAPI, Message } from '@/lib/api/sessions';
import { toast } from 'sonner';

export interface SuggestedAction {
  label: string;
  action: string;
  type?: 'primary' | 'secondary' | 'danger';
}

export interface ChatMessage extends Message {
  suggestedActions?: SuggestedAction[];
}

interface UseChatOptions {
  sessionId: string;
  onError?: (error: Error) => void;
}

const generateMessageId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const createUserMessage = (content: string): ChatMessage => ({
  id: generateMessageId(),
  sessionId: '',
  role: 'USER',
  content,
  createdAt: new Date(),
});

const createAssistantMessage = (content: string, overrides?: Partial<ChatMessage>): ChatMessage => ({
  id: generateMessageId(),
  sessionId: '',
  role: 'ASSISTANT',
  content,
  createdAt: new Date(),
  ...overrides,
});

/**
 * useChat - 聊天功能 Hook
 * 负责消息发送、流式响应处理、状态管理
 */
export function useChat({ sessionId, onError }: UseChatOptions) {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<ChatMessage | null>(null);
  const [debug, setDebug] = useState<any>({ steps: [], errors: [] });

  const messagesRef = useRef<ChatMessage[]>([]);
  const pendingTextRef = useRef('');
  const renderedTextRef = useRef('');
  const typewriterRafRef = useRef<number | null>(null);
  const lastUiUpdateAtRef = useRef<number>(0);

  // 同步 ref
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // 从 session 加载历史消息
  useEffect(() => {
    const session = queryClient.getQueryData(['session', sessionId]) as any;
    if (session?.messages) {
      setMessages(session.messages);
    }
  }, [sessionId, queryClient]);

  // 清理 typewriter
  useEffect(() => {
    return () => {
      if (typewriterRafRef.current != null) {
        window.cancelAnimationFrame(typewriterRafRef.current);
        typewriterRafRef.current = null;
      }
    };
  }, []);

  // Typewriter 效果
  const scheduleTypewriter = useCallback(() => {
    if (typewriterRafRef.current != null) return;

    typewriterRafRef.current = window.requestAnimationFrame((now) => {
      typewriterRafRef.current = null;

      const pending = pendingTextRef.current;
      if (!pending) return;

      const take = Math.min(pending.length, 24);
      renderedTextRef.current += pending.slice(0, take);
      pendingTextRef.current = pending.slice(take);

      const nextText = renderedTextRef.current;
      const shouldUpdateUi = now - lastUiUpdateAtRef.current >= 50 || pendingTextRef.current.length === 0;

      if (shouldUpdateUi) {
        lastUiUpdateAtRef.current = now;
        setStreamingMessage((prev) => {
          if (!prev) return null;
          if (prev.content === nextText) return prev;
          return {
            ...prev,
            content: nextText,
            ui: prev.ui?.type === 'explanation' ? { type: 'explanation', content: nextText } : prev.ui,
          };
        });
      }

      if (pendingTextRef.current.length > 0) {
        scheduleTypewriter();
      }
    });
  }, []);

  const stopTypewriter = useCallback(() => {
    if (typewriterRafRef.current != null) {
      window.cancelAnimationFrame(typewriterRafRef.current);
      typewriterRafRef.current = null;
    }
  }, []);

  /**
   * 发送消息
   */
  const sendMessage = useCallback(
    async (content: string, options?: { uiIntent?: string }) => {
      if (!content.trim() || isStreaming) return;

      // 添加用户消息
      const userMsg = createUserMessage(content);
      setMessages((prev) => [...prev, userMsg]);

      // 初始化流式响应
      setIsStreaming(true);
      pendingTextRef.current = '';
      renderedTextRef.current = '';
      lastUiUpdateAtRef.current = 0;
      setDebug({ steps: [], errors: [] });

      setStreamingMessage(
        createAssistantMessage('', {
          id: 'streaming-' + Date.now(),
          ui: { type: 'explanation', content: '' },
        })
      );

      try {
        let finalResponse: any = null;

        await ChatAPI.stream(sessionId, content, {
          onMeta: (data) => {
            setDebug((prev: any) => ({ ...prev, ...data }));
          },
          onStep: (data) => {
            setDebug((prev: any) => ({
              ...prev,
              steps: [...prev.steps, { name: data.name, at: Date.now() }],
            }));
          },
          onSources: (data) => {
            const sources = Array.isArray(data?.sources) ? data.sources : [];
            setStreamingMessage((prev) => (prev ? { ...prev, sources } : null));
            setDebug((prev: any) => ({
              ...prev,
              lastSources: {
                count: sources.length,
                minSimilarity: data?.minSimilarity,
              },
            }));
          },
          onDelta: (text) => {
            pendingTextRef.current += text;
            scheduleTypewriter();
          },
          onFinal: (response) => {
            finalResponse = response;
            stopTypewriter();
            pendingTextRef.current = '';

            const ui = response?.ui;
            const sources = Array.isArray(response?.sources) ? response.sources : [];
            const suggestedActions = Array.isArray(response?.suggestedActions)
              ? response.suggestedActions
              : undefined;

            if (ui?.type === 'explanation') {
              const text = String(ui?.content ?? '');
              renderedTextRef.current = text;
              setStreamingMessage((prev) =>
                prev
                  ? {
                      ...prev,
                      content: text,
                      ui,
                      sources,
                      suggestedActions,
                    }
                  : null
              );
            } else {
              setStreamingMessage((prev) =>
                prev
                  ? {
                      ...prev,
                      content: '',
                      ui,
                      sources,
                      suggestedActions,
                    }
                  : null
              );
            }
          },
          onError: (error) => {
            const message = error?.message || 'Error';
            const detail = error?.detail;
            setDebug((prev: any) => ({
              ...prev,
              errors: [...prev.errors, { message, detail, at: Date.now() }],
            }));

            stopTypewriter();
            const text = detail ? `${message}\n${detail}` : message;
            renderedTextRef.current = text;
            setStreamingMessage((prev) =>
              prev
                ? {
                    ...prev,
                    content: text,
                    ui: { type: 'explanation', content: text },
                  }
                : null
            );

            toast.error('AI 响应失败');
            onError?.(new Error(message));
          },
          onDone: () => {
            // 流式响应完成
          },
        }, options);

        // 添加最终消息
        if (finalResponse) {
          const ui = finalResponse.ui;
          const content =
            ui?.type === 'explanation' ? String(ui.content ?? '') : renderedTextRef.current || '';
          const assistantMsg = createAssistantMessage(content, {
            ui: finalResponse.ui,
            sources: finalResponse.sources,
            suggestedActions: finalResponse.suggestedActions,
          });
          setMessages((prev) => [...prev, assistantMsg]);
        }

        setStreamingMessage(null);
        setIsStreaming(false);

        // 刷新会话数据
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['session', sessionId] });
        }, 1000);
      } catch (error) {
        console.error('[useChat] Error:', error);
        stopTypewriter();
        setIsStreaming(false);
        setStreamingMessage(null);
        toast.error('发送消息失败');
        onError?.(error as Error);
      }
    },
    [sessionId, isStreaming, queryClient, scheduleTypewriter, stopTypewriter, onError]
  );

  // 显示的消息列表
  const displayMessages = streamingMessage ? [...messages, streamingMessage] : messages;

  return {
    messages: displayMessages,
    sendMessage,
    isStreaming,
    debug,
  };
}

