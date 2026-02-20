'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, RotateCcw } from 'lucide-react';
import { ChatMessages } from './ChatMessages';
import { ChatInput } from './ChatInput';

interface AISidebarEphemeralProps {
  isOpen: boolean;
  onClose: () => void;
  context: {
    articleContent?: string;      // 完整文章内容
    articleTitle?: string;         // 文章标题
    selection?: string;            // 用户选中的文本
    currentContent?: string;       // 当前阅读位置的上下文
  };
  initialMessage?: string;
  layoutMode?: 'overlay' | 'flat';
}

export function AISidebarEphemeral({ 
  isOpen, 
  onClose, 
  context, 
  initialMessage,
  layoutMode = 'overlay' 
}: AISidebarEphemeralProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<any>(null);
  const initialMessageSentRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 重置对话
  const handleReset = useCallback(() => {
    if (!confirm('确定要清空当前对话吗？')) return;
    
    // 取消正在进行的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    setMessages([]);
    setIsStreaming(false);
    setStreamingMessage(null);
    initialMessageSentRef.current = false;
  }, []);

  // 发送消息（不保存到数据库）
  const sendMessage = useCallback(async (content: string) => {
    if (isStreaming) return;
    
    // 创建新的 AbortController
    abortControllerRef.current = new AbortController();

    // 添加用户消息
    const userMsg = {
      id: `user-${Date.now()}`,
      role: 'USER',
      content,
      createdAt: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMsg]);

    // 构建完整的上下文
    const systemContext = buildSystemContext(context);
    
    setIsStreaming(true);
    setStreamingMessage({
      id: `streaming-${Date.now()}`,
      role: 'ASSISTANT',
      content: '',
      createdAt: new Date().toISOString()
    });

    try {
      const response = await fetch('/api/ai/chat-ephemeral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          context: systemContext,
          history: messages.map(m => ({
            role: m.role.toLowerCase(), // 转换为小写
            content: m.content
          }))
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[AISidebarEphemeral] API Error:', response.status, errorText);
        throw new Error(`API 请求失败: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法获取响应流');
      }

      const decoder = new TextDecoder();
      let accumulatedText = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'delta' && data.text) {
                accumulatedText += data.text;
                setStreamingMessage((prev: any) => ({
                  ...prev,
                  content: accumulatedText
                }));
              } else if (data.type === 'error') {
                throw new Error(data.message || 'AI 响应错误');
              } else if (data.type === 'done') {
                // 完成
              }
            } catch (e) {
              if (e instanceof Error && e.message !== 'Unexpected end of JSON input') {
                throw e;
              }
              // 忽略 JSON 解析错误
            }
          }
        }
      }

      // 添加完整的 AI 消息
      const assistantMsg = {
        id: `assistant-${Date.now()}`,
        role: 'ASSISTANT',
        content: accumulatedText,
        createdAt: new Date().toISOString()
      };
      setMessages(prev => [...prev, assistantMsg]);

    } catch (error: any) {
      // 忽略用户主动取消的请求
      if (error.name === 'AbortError') {
        console.log('[AISidebarEphemeral] Request aborted by user');
        return;
      }
      
      console.error('[AISidebarEphemeral] Failed to send message:', error);
      
      // 显示详细错误信息
      const errorMessage = error instanceof Error 
        ? error.message 
        : '抱歉，发生了未知错误，请重试。';
      
      const errorMsg = {
        id: `error-${Date.now()}`,
        role: 'ASSISTANT',
        content: `❌ ${errorMessage}`,
        createdAt: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsStreaming(false);
      setStreamingMessage(null);
      abortControllerRef.current = null;
    }
  }, [context, messages, isStreaming]);

  // 清理函数（修复内存泄漏）
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      // 重置初始消息标记
      initialMessageSentRef.current = false;
    };
  }, []);

  // 自动发送初始消息（只发送一次）
  useEffect(() => {
    if (isOpen && initialMessage && !initialMessageSentRef.current && messages.length === 0) {
      initialMessageSentRef.current = true;
      sendMessage(initialMessage);
    }
  }, [isOpen, initialMessage, messages.length, sendMessage]);

  // 关闭时重置状态
  useEffect(() => {
    if (!isOpen) {
      // 延迟重置，等待动画完成
      const timer = setTimeout(() => {
        initialMessageSentRef.current = false;
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const displayMessages = streamingMessage 
    ? [...messages, streamingMessage]
    : messages;

  const SidebarContent = (
    <div className="flex flex-col h-full w-full md:w-[400px] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 md:px-4 py-2.5 md:py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex-shrink-0 z-10">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 text-indigo-500 flex-shrink-0" />
          <span className="font-medium text-sm truncate">阅读助手</span>
          {messages.length > 0 && (
            <span className="text-xs text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full flex-shrink-0">
              {messages.length}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* 重置按钮 */}
          {messages.length > 0 && (
            <button
              onClick={handleReset}
              className="p-2 text-zinc-500 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors touch-manipulation active:scale-95"
              title="重置对话"
              aria-label="重置对话"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
          
          {/* 关闭按钮 */}
          <button
            onClick={onClose}
            className="p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors touch-manipulation active:scale-95"
            title="关闭"
            aria-label="关闭侧边栏"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages - 确保可以滚动 */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ChatMessages
          messages={displayMessages}
          isStreaming={isStreaming}
        />
      </div>

      {/* Input */}
      <div className="flex-shrink-0">
        <ChatInput
          onSend={sendMessage}
          disabled={isStreaming}
          placeholder="向 AI 提问..."
        />
      </div>

      {/* Footer Hint */}
      <div className="px-3 md:px-4 py-2 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex-shrink-0">
        <p className="text-xs text-zinc-500 text-center leading-relaxed">
          💡 对话仅在当前会话有效
        </p>
      </div>
    </div>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="z-50">
          {layoutMode === 'overlay' && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
              />

              {/* Sidebar */}
              <motion.aside
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed inset-y-0 right-0 z-50 w-full sm:w-[90vw] md:w-[400px] bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden"
                style={{
                  paddingTop: 'env(safe-area-inset-top)',
                  paddingBottom: 'env(safe-area-inset-bottom)',
                }}
              >
                {SidebarContent}
              </motion.aside>
            </>
          )}

          {layoutMode === 'flat' && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ 
                width: typeof window !== 'undefined' && window.innerWidth < 768 ? '100vw' : 400, 
                opacity: 1 
              }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="h-full border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex-shrink-0 overflow-hidden"
            >
              <div className="w-full md:w-[400px] h-full">
                {SidebarContent}
              </div>
            </motion.aside>
          )}
        </div>
      )}
    </AnimatePresence>
  );
}

/**
 * 构建系统上下文
 */
function buildSystemContext(context: AISidebarEphemeralProps['context']): string {
  const parts: string[] = [];

  if (context.articleTitle) {
    parts.push(`# 文章标题\n${context.articleTitle}`);
  }

  if (context.articleContent) {
    parts.push(`# 文章内容\n${context.articleContent}`);
  }

  if (context.currentContent) {
    parts.push(`# 当前阅读位置\n${context.currentContent}`);
  }

  if (context.selection) {
    parts.push(`# 用户选中的文本\n${context.selection}`);
  }

  return parts.join('\n\n---\n\n');
}

