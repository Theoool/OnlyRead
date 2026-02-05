'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Send } from 'lucide-react';
import { RenderEngine } from '@/app/components/learning/engine/RenderEngine';
import { TextWithCitations } from '@/app/components/learning/CitationChip';
import { SourceList } from '@/app/components/learning/SourceCard';
import { useCopilot, Message } from './useCopilot';
import { CopilotDebugBar } from './CopilotDebugBar';

interface CopilotWidgetProps {
  sessionId?: string;
  mode?: 'qa' | 'tutor' | 'copilot';
  context?: {
    articleIds?: string[];
    collectionId?: string;
    selection?: string;
    currentContent?: string;
  };
  variant?: 'full' | 'sidebar' | 'floating';
  initialMessages?: Message[];
}

const ChatMessage = React.memo(
  function ChatMessage({
    msg,
    onEngineAction,
  }: {
    msg: any
    onEngineAction: (action: string, value: any) => void
  }) {
    const isStreamingMessage = typeof msg?.id === 'string' && msg.id.startsWith('streaming-')
    const wrapperClass = `flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`
    const explanationText =
      msg?.ui?.type === 'explanation' ? String(msg?.ui?.content ?? '') : String(msg?.content ?? '')

    const citationSources = useMemo(() => {
      if (!Array.isArray(msg?.sources) || msg.sources.length === 0) return undefined
      return msg.sources
        .map((s: any) => ({
          title: typeof s?.title === 'string' ? s.title : '',
          articleId: typeof s?.articleId === 'string' ? s.articleId : '',
        }))
        .filter((s: any) => s.title && s.articleId)
    }, [msg?.sources])

    const content =
      msg.role === 'user' ? (
        <div className="bg-zinc-200 dark:bg-zinc-800 px-4 py-2 rounded-2xl rounded-tr-sm max-w-[85%] text-zinc-900 dark:text-zinc-100 text-sm">
          {msg.content}
        </div>
      ) : (
        <div className="w-full space-y-3 max-w-[95%]">
          {explanationText && (!msg.ui || msg.ui.type === 'explanation') && (
            <div className="bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm p-3 rounded-2xl border border-zinc-100 dark:border-zinc-800/50">
              {isStreamingMessage ? (
                <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
                  {explanationText}
                </div>
              ) : (
                <div className="prose dark:prose-invert prose-sm max-w-none">
                  <TextWithCitations text={explanationText} sources={citationSources} />
                </div>
              )}
            </div>
          )}

          {msg.ui && msg.ui.type !== 'explanation' && (
            <div className="pl-2 border-l-2 border-indigo-500/30">
              <RenderEngine component={msg.ui} onAction={onEngineAction} />
            </div>
          )}

          {msg.sources && msg.sources.length > 0 && (
            <div className="pl-1">
              <SourceList sources={msg.sources} />
            </div>
          )}
        </div>
      )

    if (isStreamingMessage) {
      return <div className={wrapperClass}>{content}</div>
    }

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={wrapperClass}
      >
        {content}
      </motion.div>
    )
  },
  (prev, next) => prev.msg === next.msg && prev.onEngineAction === next.onEngineAction,
)

export function CopilotWidget({ 
  sessionId, 
  mode = 'tutor', 
  context, 
  variant = 'full',
  initialMessages = []
}: CopilotWidgetProps) {
  const { messages: historyMessages, sendMessage, isSending, currentResponse, debug } = useCopilot({ sessionId, mode, context });
  const [inputValue, setInputValue] = useState('');
  const mainRef = useRef<HTMLElement>(null);
  const autoScrollRef = useRef(true);
  const lastScrollAtRef = useRef(0);
  const [debugOpen, setDebugOpen] = useState(false);
  const localMessagesRef = useRef<Message[]>(initialMessages);

  // Combine history with local state (for stateless QA mode)
  const [localMessages, setLocalMessages] = useState<Message[]>(initialMessages);
  const lastSessionIdRef = useRef<string | undefined>(sessionId);

  useEffect(() => {
    localMessagesRef.current = localMessages
  }, [localMessages])

  // Sync history
  useEffect(() => {
    if (lastSessionIdRef.current !== sessionId) {
      lastSessionIdRef.current = sessionId;
      setLocalMessages(historyMessages);
      return;
    }

    if (historyMessages.length > 0) {
      setLocalMessages(historyMessages);
    }
  }, [historyMessages, sessionId]);

  // Handle stateless response: manually append streaming message
  // If we have a sessionId, historyMessages will update eventually, 
  // but we want to show the streaming message immediately.
  const displayMessages = useMemo(() => {
      if (currentResponse) {
          return [...localMessages, currentResponse];
      }
      return localMessages;
  }, [localMessages, currentResponse]);


  useEffect(() => {
    const el = mainRef.current
    if (!el) return

    const threshold = 120
    const onScroll = () => {
      autoScrollRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold
    }

    onScroll()
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  const scheduleScrollToBottom = useCallback((behavior: ScrollBehavior) => {
    const el = mainRef.current
    if (!el || !autoScrollRef.current) return

    const now = performance.now()
    const minInterval = behavior === 'auto' ? 80 : 0
    if (minInterval > 0 && now - lastScrollAtRef.current < minInterval) return
    lastScrollAtRef.current = now

    requestAnimationFrame(() => {
      const nextEl = mainRef.current
      if (!nextEl || !autoScrollRef.current) return
      nextEl.scrollTo({ top: nextEl.scrollHeight, behavior })
    })
  }, [])

  useEffect(() => {
    scheduleScrollToBottom(isSending ? 'auto' : 'smooth')
  }, [scheduleScrollToBottom, localMessages.length, currentResponse?.content.length, isSending])

  const handleEngineAction = useCallback((action: string, value: any) => {
    let feedbackText = "";
    if (action === 'quiz_correct') feedbackText = `I answered correctly: ${value.answer}`;
    else if (action === 'quiz_incorrect') feedbackText = `I answered incorrectly: ${value.answer}`;
    else if (action === 'code_run') feedbackText = `I submitted code: ${value.code.substring(0, 20)}...`;

    if (feedbackText) {
      const userMsg: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: feedbackText,
        createdAt: new Date().toISOString()
      };
      setLocalMessages(prev => [...prev, userMsg]);
      sendMessage({ message: feedbackText, history: [...localMessagesRef.current, userMsg] });
    }
  }, [sendMessage]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || isSending) return;
    
    const text = inputValue;
    setInputValue(''); 
    
    // Add user message locally
    const userMsg: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: text,
        createdAt: new Date().toISOString()
    };
    setLocalMessages(prev => [...prev, userMsg]);

    try {
      const response = await sendMessage({ message: text, history: [...localMessagesRef.current, userMsg] });
      
      if (response) {
          const assistantMsg: Message = {
              id: Date.now().toString(),
              role: 'assistant',
              content: response.content,
              ui: response.ui,
              sources: response.sources,
              createdAt: new Date().toISOString()
          };
          setLocalMessages(prev => [...prev, assistantMsg]);
      }
    } catch (err) {
      setInputValue(text);
    }
  };

  const containerClasses = variant === 'full' 
    ? "flex flex-col h-full bg-zinc-50 dark:bg-zinc-950"
    : "flex flex-col h-full bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800";

  return (
    <div className={containerClasses}>
      {process.env.NODE_ENV !== 'production' && (
        <CopilotDebugBar
          enabled={debugOpen}
          debug={debug}
          onToggle={() => setDebugOpen((v) => !v)}
        />
      )}
      {/* Messages */}
      <main ref={mainRef} className="flex-1 overflow-y-auto p-4">
        <div className={`mx-auto space-y-6 pb-4 ${variant === 'full' ? 'max-w-3xl' : ''}`}>
            
          {displayMessages.length === 0 && (
              <div className="text-center text-zinc-400 mt-20">
                  <p>How can I help you today?</p>
              </div>
          )}

          {displayMessages.map((msg: any) => (
            <ChatMessage key={msg.id} msg={msg} onEngineAction={handleEngineAction} />
          ))}

          {isSending && !currentResponse && (
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-zinc-400 pl-4">
               <Loader2 className="w-4 h-4 animate-spin" />
               <span className="text-xs">Thinking...</span>
             </motion.div>
          )}
        </div>
      </main>

      {/* Input */}
      <footer className="p-3 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800">
        <div className={`mx-auto relative ${variant === 'full' ? 'max-w-3xl' : ''}`}>
          <form onSubmit={handleSend} className="relative">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={mode === 'qa' ? "Ask a question..." : "Chat with AI..."}
              className="w-full px-4 py-3 pr-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-transparent focus:border-indigo-500 focus:bg-white dark:focus:bg-zinc-950 transition-all outline-none text-sm"
              disabled={isSending}
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isSending}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg disabled:opacity-50 hover:scale-105 transition-transform"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </footer>
    </div>
  );
}
