'use client';

import { memo, useRef, useEffect } from 'react';
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
    <div className="bg-zinc-200 dark:bg-zinc-800 px-3 md:px-4 py-2 md:py-2.5 rounded-2xl rounded-tr-sm max-w-[85%] md:max-w-[80%] text-zinc-900 dark:text-zinc-100 text-sm md:text-base break-words">
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
        <div className="bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm p-3 md:p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800/50">
          {isStreaming ? (
            <div className="whitespace-pre-wrap break-words text-sm md:text-base leading-relaxed text-zinc-800 dark:text-zinc-200">
              {explanationText}
            </div>
          ) : (
            <div className="prose dark:prose-invert prose-sm md:prose-base max-w-none">
              <TextWithCitations text={explanationText} sources={citationSources} />
            </div>
          )}
        </div>
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
        <div className="flex flex-wrap gap-2 pt-2">
          {message.suggestedActions.map((action, idx) => (
            <button
              key={`${action.action}-${idx}`}
              onClick={() => onSuggestedAction?.(action)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:scale-105 active:scale-95 touch-manipulation ${
                action.type === 'primary'
                  ? 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-sm'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>
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
      className="flex items-center gap-2 text-zinc-400 pl-4 py-2"
    >
      <div className="relative">
        <Loader2 className="w-4 h-4 animate-spin" />
        <div className="absolute inset-0 bg-indigo-500/20 rounded-full animate-ping" />
      </div>
      <span className="text-xs font-medium">AI 正在思考...</span>
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

  // 自动滚动
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !autoScrollRef.current) return;

    // 只在新消息添加时滚动
    if (messages.length > lastMessageCountRef.current || isStreaming) {
      requestAnimationFrame(() => {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      });
    }
    
    lastMessageCountRef.current = messages.length;
  }, [messages.length, isStreaming]);

  // 监听滚动，判断是否需要自动滚动
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onScroll = () => {
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
      autoScrollRef.current = isNearBottom;
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div 
      ref={containerRef} 
      className="flex-1 overflow-y-auto p-3 md:p-4 overscroll-contain"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      <div className="mx-auto space-y-4 md:space-y-6 pb-4 max-w-3xl">
        {messages.length === 0 && !isStreaming && (
          <div className="text-center text-zinc-400 mt-12 md:mt-20 px-4">
            <p className="text-sm md:text-base">有什么我可以帮助你的吗？</p>
          </div>
        )}

        {messages.map((msg) => {
          const isUser = msg.role === 'USER';
          return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
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

