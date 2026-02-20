'use client';

import { memo, useState, FormEvent, useRef, useEffect, useCallback } from 'react';
import { Send } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string, options?: { uiIntent?: string }) => void;
  disabled?: boolean;
  placeholder?: string;
}

export const ChatInput = memo(function ChatInput({
  onSend,
  disabled = false,
  placeholder = '输入消息...',
}: ChatInputProps) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInput(value);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || disabled) return;

    const trimmedInput = input.trim();
    onSend(trimmedInput);
    setInput('');
    
    // 移动端：提交后失焦，收起键盘
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      inputRef.current?.blur();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Enter 发送，Shift+Enter 换行（虽然是单行输入，但保持一致性）
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  // 移动端：键盘弹起时调整布局（优化版）
  const scrollToInput = useCallback(() => {
    if (typeof window === 'undefined' || !isFocused) return;
    
    // 使用 setTimeout 确保键盘完全弹起后再滚动
    setTimeout(() => {
      if (window.innerWidth < 768) {
        // 优先使用 scrollIntoViewIfNeeded（Safari/Chrome）
        const element = containerRef.current || inputRef.current;
        if (element) {
          if ('scrollIntoViewIfNeeded' in element) {
            (element as any).scrollIntoViewIfNeeded?.(true);
          } else {
            element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }
      }
    }, 100);
  }, [isFocused]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 监听 resize 事件（键盘弹起/收起）
    const handleResize = () => {
      scrollToInput();
    };

    // 监听 visualViewport（更精确的键盘检测）
    const handleViewportChange = () => {
      scrollToInput();
    };

    window.addEventListener('resize', handleResize);
    window.visualViewport?.addEventListener('resize', handleViewportChange);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('resize', handleViewportChange);
    };
  }, [scrollToInput]);

  // 聚焦时滚动
  const handleFocus = () => {
    setIsFocused(true);
    scrollToInput();
  };

  return (
    <div 
      ref={containerRef}
      className="p-3 md:p-4 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex-shrink-0"
      style={{
        position: 'relative',
        zIndex: 10,
      }}
    >
      <div className="mx-auto max-w-3xl">
        <form onSubmit={handleSubmit} className="relative">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            disabled={disabled}
            className="w-full px-4 py-3 pr-12 rounded-xl bg-zinc-50 dark:bg-zinc-800 border-2 border-transparent focus:border-indigo-500 focus:bg-white dark:focus:bg-zinc-900 transition-all outline-none text-base disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation shadow-sm focus:shadow-lg focus:shadow-indigo-500/10"
            style={{
              fontSize: '16px',
            }}
            maxLength={2000}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            enterKeyHint="send"
          />
          <button
            type="submit"
            disabled={!input.trim() || disabled}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-gradient-to-br from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 dark:from-indigo-500 dark:to-indigo-600 dark:hover:from-indigo-600 dark:hover:to-indigo-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95 transition-all touch-manipulation shadow-lg shadow-indigo-500/30 disabled:shadow-none"
            aria-label="发送消息"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
});
