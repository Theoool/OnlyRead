'use client';

import { memo, useState, FormEvent, useRef, useEffect } from 'react';
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
    if (window.innerWidth < 768) {
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

  // 移动端：键盘弹起时调整布局
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      if (isFocused && window.innerWidth < 768) {
        // 移动端键盘弹起时，滚动到输入框
        inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isFocused]);

  return (
    <div className="p-3 md:p-4 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto max-w-3xl">
        <form onSubmit={handleSubmit} className="relative">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            disabled={disabled}
            className="w-full px-4 py-3 pr-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-transparent focus:border-indigo-500 focus:bg-white dark:focus:bg-zinc-950 transition-all outline-none text-sm md:text-base disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
            maxLength={2000}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
          />
          <button
            type="submit"
            disabled={!input.trim() || disabled}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95 transition-transform touch-manipulation"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
});
