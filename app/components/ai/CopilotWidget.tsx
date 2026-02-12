'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Send, Command } from 'lucide-react';
import { RenderEngine } from '@/app/components/learning/engine/RenderEngine';
import { TextWithCitations } from '@/app/components/learning/CitationChip';
import { SourceList } from '@/app/components/learning/SourceCard';
import { useCopilot, Message, SuggestedAction } from './useCopilot';
import { CopilotDebugBar } from './CopilotDebugBar';
import { parseSlashCommand, getMatchingCommands, isSlashCommandInput, ModeType } from '@/lib/core/ai/slash-commands';
import { calculateSRS } from '@/lib/srs';
import { useConceptStore } from '@/lib/store/useConceptStore';

interface CopilotWidgetProps {
  sessionId?: string;
  mode?: ModeType;
  context?: {
    articleIds?: string[];
    collectionId?: string;
    selection?: string;
    currentContent?: string;
  };
  variant?: 'full' | 'sidebar' | 'floating';
  initialMessages?: Message[];
}

interface ChatMessageProps {
  msg: Message;
  onEngineAction: (action: string, value?: any) => void;
  onSuggestedAction?: (action: SuggestedAction) => void;
}

const EMPTY_MESSAGES: Message[] = [];
const SCROLL_THRESHOLD = 120;
const SCROLL_MIN_INTERVAL = 80;
const MAX_INPUT_LENGTH = 2000;

const MODE_STYLES = {
  qa: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  tutor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  copilot: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
} as const;

const MODE_LABELS = {
  qa: 'QA',
  tutor: 'Tutor',
  copilot: 'Copilot'
} as const;

const generateMessageId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const createUserMessage = (content: string): Message => ({
  id: generateMessageId(),
  role: 'user',
  content,
  createdAt: new Date().toISOString()
});

const createAssistantMessage = (content: string, overrides?: Partial<Message>): Message => ({
  id: generateMessageId(),
  role: 'assistant',
  content,
  createdAt: new Date().toISOString(),
  ...overrides
});

const UserMessage = memo(function UserMessage({ content }: { content: string }) {
  return (
    <div className="bg-zinc-200 dark:bg-zinc-800 px-4 py-2 rounded-2xl rounded-tr-sm max-w-[85%] text-zinc-900 dark:text-zinc-100 text-sm">
      {content}
    </div>
  );
});

const AssistantMessage = memo(function AssistantMessage({ 
  msg, 
  onEngineAction, 
  onSuggestedAction 
}: ChatMessageProps) {
  const explanationText = useMemo(() => {
    if (msg.ui?.type === 'explanation') return String(msg.ui.content ?? '');
    return String(msg.content ?? '');
  }, [msg.ui, msg.content]);

  const citationSources = useMemo(() => {
    if (!Array.isArray(msg.sources) || msg.sources.length === 0) return undefined;
    return msg.sources
      .map(s => ({
        title: typeof s?.title === 'string' ? s.title : '',
        articleId: typeof s?.articleId === 'string' ? s.articleId : '',
      }))
      .filter(s => s.title && s.articleId);
  }, [msg.sources]);

  const isStreaming = msg.id.startsWith('streaming-');

  return (
    <div className="w-full space-y-3 max-w-[95%]">
      {explanationText && (!msg.ui || msg.ui.type === 'explanation') && (
        <div className="bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm p-3 rounded-2xl border border-zinc-100 dark:border-zinc-800/50">
          {isStreaming ? (
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

      {msg.suggestedActions && msg.suggestedActions.length > 0 && (
        <SuggestedActionList 
          actions={msg.suggestedActions} 
          onAction={onSuggestedAction} 
        />
      )}
    </div>
  );
});

const SuggestedActionList = memo(function SuggestedActionList({ 
  actions, 
  onAction 
}: { 
  actions: SuggestedAction[]; 
  onAction?: (action: SuggestedAction) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 pt-2">
      {actions.map((action, idx) => (
        <button
          key={`${action.action}-${idx}`}
          onClick={() => onAction?.(action)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:scale-105 ${
            action.type === 'primary'
              ? 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-sm'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
          }`}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
});

const ChatMessage = memo(function ChatMessage(props: ChatMessageProps) {
  const { msg } = props;
  const isUser = msg.role === 'user';
  const wrapperClass = `flex ${isUser ? 'justify-end' : 'justify-start'}`;
  const isStreaming = msg.id.startsWith('streaming-');

  const content = isUser ? (
    <UserMessage content={msg.content} />
  ) : (
    <AssistantMessage {...props} />
  );

  if (isStreaming) {
    return <div className={wrapperClass}>{content}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={wrapperClass}
    >
      {content}
    </motion.div>
  );
}, (prev, next) => 
  prev.msg.id === next.msg.id && 
  prev.msg.content === next.msg.content &&
  prev.onEngineAction === next.onEngineAction && 
  prev.onSuggestedAction === next.onSuggestedAction
);

const CommandPalette = memo(function CommandPalette({
  suggestions,
  onSelect,
  onClose
}: {
  suggestions: Array<{ command: string; description: string }>;
  onSelect: (command: string) => void;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-xl overflow-hidden z-50"
    >
      <div className="p-2 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
        <Command className="w-3 h-3 text-zinc-400" />
        <span className="text-xs text-zinc-500">可用命令</span>
      </div>
      {suggestions.map((cmd, idx) => (
        <button
          key={`${cmd.command}-${idx}`}
          type="button"
          onClick={() => {
            onSelect(cmd.command);
            onClose();
          }}
          className="w-full px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors flex items-center justify-between"
        >
          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{cmd.command}</span>
          <span className="text-xs text-zinc-500">{cmd.description}</span>
        </button>
      ))}
    </motion.div>
  );
});
const LoadingIndicator = memo(function LoadingIndicator({ 
  type = 'thinking' 
}: { 
  type?: 'thinking' | 'typing' | 'loading' 
}) {
  const labels = {
    thinking: 'Thinking...',
    typing: 'AI is typing...',
    loading: 'Loading...'
  };

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
      <span className="text-xs font-medium">{labels[type]}</span>
    </motion.div>
  );
});
const SkeletonMessage = memo(function SkeletonMessage() {
  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }}
      className="flex justify-start w-full"
    >
      <div className="w-full max-w-[95%] space-y-3">
        <div className="bg-white/50 dark:bg-zinc-900/50 p-3 rounded-2xl border border-zinc-100 dark:border-zinc-800/50 space-y-2">
          <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse w-3/4" />
          <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse w-1/2" />
          <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse w-5/6" />
        </div>
      </div>
    </motion.div>
  );
});
function useScrollToBottom(
  containerRef: React.RefObject<HTMLElement>,
  deps: React.DependencyList
) {
  const autoScrollRef = useRef(true);
  const lastScrollAtRef = useRef(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onScroll = () => {
      autoScrollRef.current = 
        el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_THRESHOLD;
    };

    onScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = containerRef.current;
    if (!el || !autoScrollRef.current) return;

    const now = performance.now();
    if (behavior === 'auto' && now - lastScrollAtRef.current < SCROLL_MIN_INTERVAL) return;
    lastScrollAtRef.current = now;

    requestAnimationFrame(() => {
      const currentEl = containerRef.current;
      if (!currentEl || !autoScrollRef.current) return;
      currentEl.scrollTo({ top: currentEl.scrollHeight, behavior });
    });
  }, []);

  useEffect(() => {
    scrollToBottom('auto');
  }, deps);
}

function useMessageSync(
  sessionId: string | undefined,
  initialMessagesProp: Message[] | undefined,
  historyMessages: Message[]
) {
  const [localMessages, setLocalMessages] = useState<Message[]>(initialMessagesProp ?? EMPTY_MESSAGES);
  const lastSessionIdRef = useRef(sessionId);
  const lastInitialMessagesRef = useRef(initialMessagesProp);
  const historyMessagesLengthRef = useRef(historyMessages.length);

  useEffect(() => {
    // Case 1: Session ID changed
    if (lastSessionIdRef.current !== sessionId) {
      lastSessionIdRef.current = sessionId;
      lastInitialMessagesRef.current = initialMessagesProp;
      setLocalMessages(initialMessagesProp ?? EMPTY_MESSAGES);
      historyMessagesLengthRef.current = historyMessages.length;
      return;
    }
    
    // Case 2: Initial messages changed
    if (initialMessagesProp !== lastInitialMessagesRef.current) {
      lastInitialMessagesRef.current = initialMessagesProp;
      setLocalMessages(initialMessagesProp ?? EMPTY_MESSAGES);
      historyMessagesLengthRef.current = historyMessages.length;
      return;
    }

    // Case 3: History messages loaded from API
    if (historyMessages.length > 0 && historyMessages.length !== historyMessagesLengthRef.current) {
      historyMessagesLengthRef.current = historyMessages.length;
      setLocalMessages(prev => {
        const prevLastMsg = prev[prev.length - 1];
        const newLastMsg = historyMessages[historyMessages.length - 1];
        if (prevLastMsg?.id === newLastMsg?.id && prev.length === historyMessages.length) {
          return prev;
        }
        return historyMessages;
      });
    }
  }, [historyMessages, sessionId, initialMessagesProp]);

  return { localMessages, setLocalMessages };
}

export function CopilotWidget({ 
  sessionId, 
  mode: initialMode = 'tutor', 
  context, 
  variant = 'full',
  initialMessages: initialMessagesProp
}: CopilotWidgetProps) {
  // State
  const [mode, setMode] = useState<ModeType>(initialMode);
  const [inputValue, setInputValue] = useState('');
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandSuggestions, setCommandSuggestions] = useState<Array<{ command: string; description: string }>>([]);
  const [debugOpen, setDebugOpen] = useState(false);
  
  // Refs
  const mainRef = useRef<HTMLElement>(null);
  const localMessagesRef = useRef<Message[]>(EMPTY_MESSAGES);
  
  // Hooks
  const { 
    messages: historyMessages, 
    sendMessage, 
    isLoading, 
    isSending, 
    currentResponse, 
    debug 
  } = useCopilot({ sessionId, mode, context });
  
  const { localMessages, setLocalMessages } = useMessageSync(
    sessionId, 
    initialMessagesProp, 
    historyMessages
  );
  
  const { addConcept, updateConcept, getConcept } = useConceptStore();

  // Sync ref with state
  useEffect(() => {
    localMessagesRef.current = localMessages;
  }, [localMessages]);

  // Scroll management
  useScrollToBottom(
    mainRef,
    [localMessages.length, currentResponse?.content?.length, isSending]
  );

  // Derived state
  const displayMessages = useMemo(() => {
    if (currentResponse) {
      return [...localMessages, currentResponse];
    }
    return localMessages;
  }, [localMessages, currentResponse]);

  // ==========================================
  // 事件处理
  // ==========================================

  const handleEngineAction = useCallback((action: string, value?: any) => {
    let feedbackText = '';
    let shouldSend = true;

    // Action handlers mapping
    const actionHandlers: Record<string, () => void> = {
      quiz_correct: () => {
        feedbackText = `我回答正确: ${value?.answer || ''}`;
      },
      quiz_incorrect: () => {
        feedbackText = `我回答错误: ${value?.answer || ''}`;
      },
      code_run: () => {
        feedbackText = `我提交了代码: ${value?.code?.substring(0, 20)}...`;
      },
      node_click: () => {
        feedbackText = `我想了解 "${value?.label || '这个概念'}" 的详细信息`;
      },
      review: () => {
        feedbackText = '开始复习闪卡';
      },
      more_cards: () => {
        feedbackText = '生成更多闪卡';
      },
      fill_blank_done: () => {
        feedbackText = '我完成了填空练习';
      },
      srs_review: () => {
        const { card, quality } = value || {};
        if (!card || quality === undefined) return;
        
        const existingConcept = getConcept(card.front);
        if (existingConcept) {
          const srsUpdate = calculateSRS(existingConcept, quality);
          updateConcept(card.front, {
            ...srsUpdate,
            lastReviewedAt: Date.now()
          });
          feedbackText = `闪卡 "${card.front.substring(0, 20)}..." 复习完成 (${quality >= 4 ? '记住' : '需复习'})`;
        } else {
          addConcept({
            term: card.front,
            myDefinition: card.back,
            myExample: card.hint || '',
            confidence: quality >= 4 ? 4 : 2,
            createdAt: Date.now(),
            sourceArticleId: context?.articleIds?.[0],
            reviewCount: 1,
            lastReviewedAt: Date.now(),
            easeFactor: 2.5,
            interval: quality < 3 ? 1 : 1
          });
          feedbackText = `已将 "${card.front.substring(0, 20)}..." 添加到笔记`;
        }
      },
      save_concept: () => {
        const { card } = value || {};
        if (!card) return;
        
        const existingConcept = getConcept(card.front);
        if (!existingConcept) {
          addConcept({
            term: card.front,
            myDefinition: card.back,
            myExample: card.hint || '',
            confidence: 3,
            createdAt: Date.now(),
            sourceArticleId: context?.articleIds?.[0],
            reviewCount: 0,
            easeFactor: 2.5,
            interval: 0
          });
          feedbackText = `已保存 "${card.front.substring(0, 20)}..." 到笔记`;
        } else {
          feedbackText = `"${card.front.substring(0, 20)}..." 已在笔记中`;
        }
      }
    };

    // Check if action should be handled silently (suggested actions)
    const silentActions = [
      'drill_down', 'quiz', 'explain_diff', 'example', 'hint', 
      'explain_answer', 'understood', 'mindmap', 'drill_first', 
      'generate_mindmap', 'quiz_overview', 'start_learning', 
      'start_topic_1', 'next_quiz', 'explain_more'
    ];
    
    if (silentActions.includes(action)) {
      shouldSend = false;
    } else if (actionHandlers[action]) {
      actionHandlers[action]();
    }

    if (shouldSend && feedbackText) {
      const userMsg = createUserMessage(feedbackText);
      setLocalMessages(prev => [...prev, userMsg]);
      sendMessage({ 
        message: feedbackText, 
        history: [...localMessagesRef.current, userMsg] 
      });
    }
  }, [sendMessage, addConcept, updateConcept, getConcept, context]);

  const handleSuggestedAction = useCallback((action: SuggestedAction) => {
    const userMsg = createUserMessage(action.label);
    setLocalMessages(prev => [...prev, userMsg]);
    sendMessage({ 
      message: action.label, 
      history: [...localMessagesRef.current, userMsg] 
    });
  }, [sendMessage]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value.length > MAX_INPUT_LENGTH) return;
    
    setInputValue(value);
    
    if (isSlashCommandInput(value)) {
      const suggestions = getMatchingCommands(value);
      setCommandSuggestions(suggestions);
      setShowCommandPalette(suggestions.length > 0);
    } else {
      setShowCommandPalette(false);
    }
  }, []);

  const executeSlashCommand = useCallback((input: string): { handled: boolean; uiIntent?: string } => {
    const result = parseSlashCommand(input, mode);
    if (!result) return { handled: false };

    const systemMsgCreators: Record<string, () => Message> = {
      mode_switch: () => {
        if (result.mode) setMode(result.mode);
        return createAssistantMessage(result.message || `已切换到 ${result.mode} 模式`);
      },
      system_message: () => createAssistantMessage(result.message || ''),
      unknown: () => createAssistantMessage(result.message || ''),
      help: () => {
        const helpText = result.commands?.map(cmd => `${cmd.command}: ${cmd.description}`).join('\n') || '';
        return createAssistantMessage(`可用命令:\n${helpText}`);
      }
    };

    if (result.type === 'ui_intent') {
      return { handled: false, uiIntent: result.uiIntent };
    }

    const creator = systemMsgCreators[result.type];
    if (creator) {
      setLocalMessages(prev => [...prev, creator()]);
      return { handled: true };
    }

    return { handled: false };
  }, [mode]);

  const handleSend = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || isSending) return;
    
    const text = inputValue;
    setInputValue('');
    setShowCommandPalette(false);
    
    // Check slash command
    const commandResult = executeSlashCommand(text);
    if (commandResult.handled) return;
    
    // Add user message
    const userMsg = createUserMessage(text);
    setLocalMessages(prev => [...prev, userMsg]);

    try {
      const response = await sendMessage({ 
        message: text, 
        history: [...localMessagesRef.current, userMsg],
        uiIntent: commandResult.uiIntent
      });
      
      if (response) {
        const assistantMsg = createAssistantMessage(response.content, {
          ui: response.ui,
          sources: response.sources,
          suggestedActions: response.suggestedActions
        });
        setLocalMessages(prev => [...prev, assistantMsg]);
      }
    } catch (err) {
      // Restore input on error
      setInputValue(text);
      console.error('Failed to send message:', err);
    }
  }, [inputValue, isSending, executeSlashCommand, sendMessage]);

  // ==========================================
  // 渲染
  // ==========================================

  const containerClasses = useMemo(() => {
    const base = "flex flex-col h-full";
    return variant === 'full' 
      ? `${base} bg-zinc-50 dark:bg-zinc-950`
      : `${base} bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800`;
  }, [variant]);

  const renderLoadingState = () => {
    // 1. 初始加载历史消息 (首次加载)
    if (isLoading && displayMessages.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full space-y-4">
          <div className="relative">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            <div className="absolute inset-0 bg-indigo-500/30 rounded-full animate-ping" />
          </div>
          <p className="text-sm text-zinc-500">加载对话历史...</p>
        </div>
      );
    }

    // 2. 发送中且没有流式响应 (等待服务器响应)
    if (isSending && !currentResponse) {
      return <LoadingIndicator type="thinking" />;
    }

    // 3. 有流式响应正在接收 (显示在消息列表中，不需要额外加载指示器)
    return null;
  };

  return (
    <div className={containerClasses}>
      {process.env.NODE_ENV !== 'production' && (
        <CopilotDebugBar
          enabled={debugOpen}
          debug={debug}
          onToggle={() => setDebugOpen(v => !v)}
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

          {displayMessages.map((msg) => (
            <ChatMessage 
              key={msg.id} 
              msg={msg} 
              onEngineAction={handleEngineAction} 
              onSuggestedAction={handleSuggestedAction}
            />
          ))}
          {renderLoadingState()}
        </div>
      </main>

      {/* Input */}
      <footer className="p-3 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800">
        <div className={`mx-auto relative ${variant === 'full' ? 'max-w-3xl' : ''}`}>
          {/* Mode Indicator */}
          <div className="flex items-center gap-2 mb-2 px-1">
            <span className="text-xs text-zinc-500">模式:</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${MODE_STYLES[mode]}`}>
              {MODE_LABELS[mode]}
            </span>
            <span className="text-xs text-zinc-400">输入 / 查看命令</span>
          </div>
          
          <form onSubmit={handleSend} className="relative">
            <input
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              placeholder={mode === 'qa' ? "Ask a question..." : "Chat with AI... (输入 / 切换模式)"}
              className="w-full px-4 py-3 pr-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-transparent focus:border-indigo-500 focus:bg-white dark:focus:bg-zinc-950 transition-all outline-none text-sm"
                 disabled={isLoading || isSending} 
              maxLength={MAX_INPUT_LENGTH}
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isSending}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg disabled:opacity-50 hover:scale-105 transition-transform"
            >
              <Send className="w-4 h-4" />
            </button>
            
            <AnimatePresence>
              {showCommandPalette && commandSuggestions.length > 0 && (
                <CommandPalette
                  suggestions={commandSuggestions}
                  onSelect={setInputValue}
                  onClose={() => setShowCommandPalette(false)}
                />
              )}
            </AnimatePresence>
          </form>
        </div>
      </footer>
    </div>
  );
}
