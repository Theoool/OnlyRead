'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
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

interface ChatMessageProps {
  msg: Message
  onEngineAction: (action: string, value?: any) => void
  onSuggestedAction?: (action: SuggestedAction) => void
}

const ChatMessage = React.memo(
  function ChatMessage({
    msg,
    onEngineAction,
    onSuggestedAction,
  }: ChatMessageProps) {
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

          {/* Suggested Actions */}
          {msg.suggestedActions && msg.suggestedActions.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {msg.suggestedActions.map((action, idx) => (
                <button
                  key={idx}
                  onClick={() => onSuggestedAction?.(action)}
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
  (prev, next) => prev.msg === next.msg && prev.onEngineAction === next.onEngineAction && prev.onSuggestedAction === next.onSuggestedAction,
)

// Stable empty array reference to avoid infinite re-renders
const EMPTY_MESSAGES: Message[] = [];

export function CopilotWidget({ 
  sessionId, 
  mode: initialMode = 'tutor', 
  context, 
  variant = 'full',
  initialMessages: initialMessagesProp
}: CopilotWidgetProps) {
  // Use stable reference for initialMessages
  const initialMessages = initialMessagesProp ?? EMPTY_MESSAGES;
  
  // Mode state - can be switched at runtime via slash commands
  const [mode, setMode] = useState<ModeType>(initialMode);
  const { messages: historyMessages, sendMessage, isSending, currentResponse, debug } = useCopilot({ sessionId, mode, context });
  const [inputValue, setInputValue] = useState('');
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandSuggestions, setCommandSuggestions] = useState<Array<{ command: string; description: string }>>([]);
  const mainRef = useRef<HTMLElement>(null);
  const autoScrollRef = useRef(true);
  const lastScrollAtRef = useRef(0);
  const [debugOpen, setDebugOpen] = useState(false);
  const localMessagesRef = useRef<Message[]>(initialMessages);
  
  // Concept store for SRS integration
  const { addConcept, updateConcept, getConcept } = useConceptStore();

  // Combine history with local state (for stateless QA mode)
  const [localMessages, setLocalMessages] = useState<Message[]>(initialMessages);
  const lastSessionIdRef = useRef<string | undefined>(sessionId);
  const lastInitialMessagesRef = useRef<Message[]>(initialMessages);
  const historyMessagesLengthRef = useRef(historyMessages.length);

  useEffect(() => {
    localMessagesRef.current = localMessages
  }, [localMessages])

  // Sync history - handle session change and initialMessages change
  useEffect(() => {
    // Case 1: Session ID changed
    if (lastSessionIdRef.current !== sessionId) {
      lastSessionIdRef.current = sessionId;
      lastInitialMessagesRef.current = initialMessages;
      setLocalMessages(initialMessages);
      historyMessagesLengthRef.current = historyMessages.length;
      return;
    }
    
    // Case 2: Initial messages changed (for session switching)
    if (initialMessages !== lastInitialMessagesRef.current) {
      lastInitialMessagesRef.current = initialMessages;
      setLocalMessages(initialMessages);
      historyMessagesLengthRef.current = historyMessages.length;
      return;
    }

    // Case 3: History messages loaded from API
    // Only update if historyMessages has actual content and length changed
    if (historyMessages.length > 0 && historyMessages.length !== historyMessagesLengthRef.current) {
      historyMessagesLengthRef.current = historyMessages.length;
      setLocalMessages(prev => {
        // Check if the new history is actually different from current local messages
        // Compare by checking if the last message IDs are different
        const prevLastMsg = prev[prev.length - 1];
        const newLastMsg = historyMessages[historyMessages.length - 1];
        if (prevLastMsg?.id === newLastMsg?.id && prev.length === historyMessages.length) {
          return prev; // No change needed
        }
        return historyMessages;
      });
    }
  }, [historyMessages, sessionId, initialMessages]);

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

  const handleEngineAction = useCallback((action: string, value?: any) => {
    let feedbackText = "";
    
    // Quiz actions
    if (action === 'quiz_correct') feedbackText = `我回答正确: ${value?.answer || ''}`;
    else if (action === 'quiz_incorrect') feedbackText = `我回答错误: ${value?.answer || ''}`;
    
    // Code actions
    else if (action === 'code_run') feedbackText = `我提交了代码: ${value?.code?.substring(0, 20)}...`;
    
    // Mindmap actions
    else if (action === 'node_click') feedbackText = `我想了解 "${value?.label || '这个概念'}" 的详细信息`;
    
    // Flashcard actions
    else if (action === 'review') feedbackText = "开始复习闪卡";
    else if (action === 'more_cards') feedbackText = "生成更多闪卡";
    
    // SRS Review action
    else if (action === 'srs_review') {
      const { card, quality } = value || {};
      if (card && quality !== undefined) {
        // Try to find existing concept
        const existingConcept = getConcept(card.front);
        
        if (existingConcept) {
          // Update existing concept with SRS
          const srsUpdate = calculateSRS(existingConcept, quality);
          updateConcept(card.front, {
            ...srsUpdate,
            lastReviewedAt: Date.now()
          });
          feedbackText = `闪卡 "${card.front.substring(0, 20)}..." 复习完成 (${quality >= 4 ? '记住' : '需复习'})`;
        } else {
          // Create new concept from flashcard
          const newConcept = {
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
          };
          addConcept(newConcept);
          feedbackText = `已将 "${card.front.substring(0, 20)}..." 添加到笔记`;
        }
      }
    }
    
    // Save concept action
    else if (action === 'save_concept') {
      const { card } = value || {};
      if (card) {
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
    }
    
    // Fill in blank actions
    else if (action === 'fill_blank_done') feedbackText = "我完成了填空练习";
    
    // Suggested action mappings (from generators.ts)
    else if (['drill_down', 'quiz', 'explain_diff', 'example', 'hint', 
               'explain_answer', 'understood', 'mindmap', 'drill_first', 
               'generate_mindmap', 'quiz_overview', 'start_learning', 
               'start_topic_1', 'next_quiz', 'explain_more'].includes(action)) {
      // These are handled by suggested actions, no need to send feedback
      return;
    }

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
  }, [sendMessage, addConcept, updateConcept, getConcept, context]);

  const handleSuggestedAction = useCallback((action: SuggestedAction) => {
    // Send the action label as a user message
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: action.label,
      createdAt: new Date().toISOString()
    };
    setLocalMessages(prev => [...prev, userMsg]);
    sendMessage({ message: action.label, history: [...localMessagesRef.current, userMsg] });
  }, [sendMessage]);

  // Handle input change with slash command detection
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    
    // Check for slash commands
    if (isSlashCommandInput(value)) {
      const suggestions = getMatchingCommands(value);
      setCommandSuggestions(suggestions);
      setShowCommandPalette(suggestions.length > 0);
    } else {
      setShowCommandPalette(false);
    }
  };

  // Handle slash command execution
  const executeSlashCommand = (input: string): { handled: boolean; uiIntent?: string } => {
    const result = parseSlashCommand(input, mode);
    
    if (!result) return { handled: false }; // Not a command
    
    switch (result.type) {
      case 'mode_switch':
        if (result.mode) {
          setMode(result.mode);
          // Add system message to show mode switch
          const systemMsg: Message = {
            id: Date.now().toString(),
            role: 'assistant',
            content: result.message || `已切换到 ${result.mode} 模式`,
            createdAt: new Date().toISOString()
          };
          setLocalMessages(prev => [...prev, systemMsg]);
        }
        return { handled: true };
        
      case 'system_message':
      case 'unknown':
        const infoMsg: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: result.message || '',
          createdAt: new Date().toISOString()
        };
        setLocalMessages(prev => [...prev, infoMsg]);
        return { handled: true };
        
      case 'help':
        const helpText = result.commands?.map(cmd => `${cmd.command}: ${cmd.description}`).join('\n') || '';
        const helpMsg: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: `可用命令:\n${helpText}`,
          createdAt: new Date().toISOString()
        };
        setLocalMessages(prev => [...prev, helpMsg]);
        return { handled: true };
        
      case 'ui_intent':
        // UI Intent commands should be sent to AI with the specified intent
        return { handled: false, uiIntent: result.uiIntent };
    }
    
    return { handled: false };
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || isSending) return;
    
    const text = inputValue;
    setInputValue('');
    setShowCommandPalette(false);
    
    // Check if it's a slash command
    const commandResult = executeSlashCommand(text);
    if (commandResult.handled) {
      return; // Command handled, don't send to AI
    }
    
    // Add user message locally
    const userMsg: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: text,
        createdAt: new Date().toISOString()
    };
    setLocalMessages(prev => [...prev, userMsg]);

    try {
      const response = await sendMessage({ 
        message: text, 
        history: [...localMessagesRef.current, userMsg],
        uiIntent: commandResult.uiIntent // Pass uiIntent if from slash command
      });
      
      if (response) {
          const assistantMsg: Message = {
              id: Date.now().toString(),
              role: 'assistant',
              content: response.content,
              ui: response.ui,
              sources: response.sources,
              suggestedActions: response.suggestedActions,
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
            <ChatMessage 
              key={msg.id} 
              msg={msg} 
              onEngineAction={handleEngineAction} 
              onSuggestedAction={handleSuggestedAction}
            />
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
          {/* Mode Indicator */}
          <div className="flex items-center gap-2 mb-2 px-1">
            <span className="text-xs text-zinc-500">模式:</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              mode === 'qa' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
              mode === 'tutor' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' :
              'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
            }`}>
              {mode === 'qa' ? 'QA' : mode === 'tutor' ? 'Tutor' : 'Copilot'}
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
              disabled={isSending}
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isSending}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg disabled:opacity-50 hover:scale-105 transition-transform"
            >
              <Send className="w-4 h-4" />
            </button>
            
            {/* Command Palette */}
            <AnimatePresence>
              {showCommandPalette && commandSuggestions.length > 0 && (
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
                  {commandSuggestions.map((cmd, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setInputValue(cmd.command);
                        setShowCommandPalette(false);
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors flex items-center justify-between"
                    >
                      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{cmd.command}</span>
                      <span className="text-xs text-zinc-500">{cmd.description}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </form>
        </div>
      </footer>
    </div>
  );
}
