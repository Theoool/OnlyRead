'use client';

import { memo, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { ChatMessage as ChatMessageType } from '@/lib/hooks/useChat';
import { RenderEngine } from '@/app/components/learning/engine/RenderEngine';
import { TextWithCitations } from '@/app/components/learning/CitationChip';
import { SourceList } from '@/app/components/learning/SourceCard';

interface ChatMessagesProps {
  messages: ChatMessageType[];
  isStreaming: boolean;
  onEngineAction?: (action: string, value?: any) => void;
  onSuggestedAction?: (action: any) => void;
}

const UserMessage = memo(function UserMessage({ content }: { content: string }) {
  return (
    <div className="bg-gradient-to-br from-indigo-600 to-indigo-500 dark:from-indigo-500 dark:to-indigo-600 px-3 md:px-4 py-2.5 md:py-3 rounded-2xl rounded-tr-sm max-w-[85%] md:max-w-[80%] text-white text-sm md:text-base break-words shadow-lg shadow-indigo-500/25">
      {content}
    </div>
  );
});

const AssistantMessage = memo(function AssistantMessage({
  message,
  onEngineAction,
  onSuggestedAction,
}: {
  message: ChatMessageType;
  onEngineAction?: (action: string, value?: any) => void;
  onSuggestedAction?: (action: any) => void;
}) {
  const explanationText = message.ui?.type === 'explanation' 
    ? String(message.ui.content ?? '') 
    : String(message.content ?? '');

  const citationSources = message.sources
    ?.map(s => ({
      title: typeof s?.title === 'string' ? s.title : '',
      articleId: typeof s?.articleId === 'string' ? s.articleId : '',
    }))
    .filter(s => s.title && s.articleId);

  const isStreaming = message.id.startsWith('streaming-');

  return (
    <div className="w-full space-y-2 md:space-y-3 max-w-[95%]">
      {explanationText && (!message.ui || message.ui.type === 'explanation') && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-zinc-900 backdrop-blur-sm p-3 md:p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow"
        >
          {isStreaming ? (
            <div className="whitespace-pre-wrap break-words text-sm md:text-base leading-relaxed text-zinc-800 dark:text-zinc-200">
              {explanationText}
            </div>
          ) : (
            <div className="prose dark:prose-invert prose-sm md:prose-base max-w-none">
              <TextWithCitations text={explanationText} sources={citationSources} />
            </div>
          )}
        </motion.div>
      )}

      {message.ui && message.ui.type !== 'explanation' && (
        <div className="pl-2 border-l-2 border-indigo-500/30">
          <RenderEngine component={message.ui} onAction={onEngineAction!} />
        </div>
      )}

      {message.sources && message.sources.length > 0 && (
        <div className="pl-1">
          <SourceList sources={message.sources} />
        </div>
      )}

      {message.suggestedActions && message.suggestedActions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-wrap gap-2 pt-2"
        >
          {message.suggestedActions.map((action, idx) => (
            <motion.button
              key={`${action.action}-${idx}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => onSuggestedAction?.(action)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:scale-105 active:scale-95 touch-manipulation ${
                action.type === 'primary'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:from-indigo-600 hover:to-purple-600 shadow-lg shadow-indigo-500/25'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700'
              }`}
            >
              {action.label}
            </motion.button>
          ))}
        </motion.div>
      )}
    </div>
  );
});

const LoadingIndicator = memo(function LoadingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex items-center gap-3 text-zinc-400 pl-4 py-3"
    >
      <div className="relative">
        <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
        <div className="absolute inset-0 bg-indigo-500/20 rounded-full animate-ping" />
      </div>
      <div className="flex gap-1">
        <motion.span
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}
          className="w-1.5 h-1.5 bg-indigo-500 rounded-full"
        />
        <motion.span
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
          className="w-1.5 h-1.5 bg-indigo-500 rounded-full"
        />
        <motion.span
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
          className="w-1.5 h-1.5 bg-indigo-500 rounded-full"
        />
      </div>
      <span className="text-xs font-medium">AI 正在思考</span>
    </motion.div>
  );
});

export const ChatMessages = memo(function ChatMessages({
  messages,
  isStreaming,
  onEngineAction,
  onSuggestedAction,
}: ChatMessagesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  const lastMessageCountRef = useRef(0);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 自动滚动（优化版）
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = containerRef.current;
    if (!el) return;

    // 使用 requestAnimationFrame 确保 DOM 更新完成
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.scrollTo({ 
          top: el.scrollHeight, 
          behavior,
        });
      });
    });
  }, []);

  // 监听消息变化
  useEffect(() => {
    if (!autoScrollRef.current) return;

    // 新消息或流式更新时滚动
    if (messages.length > lastMessageCountRef.current || isStreaming) {
      scrollToBottom();
    }
    
    lastMessageCountRef.current = messages.length;
  }, [messages.length, isStreaming, scrollToBottom]);

  // 监听滚动，判断是否需要自动滚动（带防抖）
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onScroll = () => {
      // 清除之前的定时器
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // 防抖处理
      scrollTimeoutRef.current = setTimeout(() => {
        const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
        autoScrollRef.current = isNearBottom;
      }, 100);
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div 
      ref={containerRef} 
      className="h-full overflow-y-auto overflow-x-hidden p-3 md:p-4 overscroll-contain scroll-smooth"
      style={{ 
        WebkitOverflowScrolling: 'touch',
        // 移动端优化：防止滚动卡顿
        willChange: 'scroll-position',
        // 确保可以滚动
        touchAction: 'pan-y',
      }}
    >
      <div className="mx-auto space-y-4 md:space-y-6 pb-4 max-w-3xl">
        {messages.length === 0 && !isStreaming && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mt-12 md:mt-20 px-4"
          >
            <div className="w-16 h-16 md:w-20 md:h-20 mx-auto mb-4 md:mb-6 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-2xl flex items-center justify-center">
              <motion.div
                animate={{ 
                  scale: [1, 1.1, 1],
                  rotate: [0, 5, -5, 0]
                }}
                transition={{ 
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                <Loader2 className="w-8 h-8 md:w-10 md:h-10 text-indigo-500" />
              </motion.div>
            </div>
            <p className="text-sm md:text-base text-zinc-600 dark:text-zinc-400 font-medium mb-2">
              有什么我可以帮助你的吗？
            </p>
            <p className="text-xs md:text-sm text-zinc-400">
              开始提问，让我们一起探索知识
            </p>
          </motion.div>
        )}

        {messages.map((msg) => {
          const isUser = msg.role === 'USER';
          return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {isUser ? (
                <UserMessage content={msg.content || ''} />
              ) : (
                <AssistantMessage
                  message={msg}
                  onEngineAction={onEngineAction}
                  onSuggestedAction={onSuggestedAction}
                />
              )}
            </motion.div>
          );
        })}

        <AnimatePresence>
          {isStreaming && <LoadingIndicator />}
        </AnimatePresence>
      </div>
    </div>
  );
});

