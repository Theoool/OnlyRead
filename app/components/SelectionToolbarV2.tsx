'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, MessageCircle, Lightbulb, BookOpen } from 'lucide-react';

interface SelectionToolbarProps {
  onActivate: (text: string, rect: DOMRect) => void;
  disabled?: boolean;
  onAskAi?: (text: string) => void;
}

const QUICK_PROMPTS = [
  { icon: MessageCircle, label: '解释', prompt: '请解释这段内容：' },
  { icon: Lightbulb, label: '举例', prompt: '请举例说明这段内容：' },
  { icon: BookOpen, label: '总结', prompt: '请总结这段内容：' },
];

export function SelectionToolbarV2({ onActivate, disabled, onAskAi }: SelectionToolbarProps) {
  const [selection, setSelection] = useState<{ text: string; rect: DOMRect } | null>(null);
  const [showQuickPrompts, setShowQuickPrompts] = useState(false);
  const timeoutRef = useRef<any>({});
  const toolbarRef = useRef<HTMLDivElement>(null);

  const handleSelectionChange = useCallback(() => {
    if (disabled) return;

    // 延迟检查，避免与输入框冲突
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    timeoutRef.current = setTimeout(() => {
      const sel = window.getSelection();
      const text = sel?.toString().trim();

      // 检查选中文本是否在输入框内
      if (text && sel) {
        const range = sel.getRangeAt(0);
        const container = range.commonAncestorContainer;
        const element = container.nodeType === 3 ? container.parentElement : container as Element;
        
        // 排除输入框、文本域等可编辑元素
        if (element && (
          element.tagName === 'INPUT' ||
          element.tagName === 'TEXTAREA' ||
         
          element.closest('input, textarea, [contenteditable="true"]')
        )) {
          setSelection(null);
          setShowQuickPrompts(false);
          return;
        }
      }

      if (text && text.length > 0 && text.length < 500) {
        const range = sel?.getRangeAt(0);
        const rect = range?.getBoundingClientRect();
        if (rect && rect.width > 0 && rect.height > 0) {
          setSelection({ text, rect });
        }
      } else {
        setSelection(null);
        setShowQuickPrompts(false);
      }
    }, 100);
  }, [disabled]);

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange);
    
    // 点击外部关闭
    const handleClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setShowQuickPrompts(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('mousedown', handleClickOutside);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [handleSelectionChange]);

  const handleSaveConcept = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (selection) {
      onActivate(selection.text, selection.rect);
      setSelection(null);
      setShowQuickPrompts(false);
    }
  }, [selection, onActivate]);

  const handleAskAi = useCallback((e: React.MouseEvent, prompt?: string) => {
    e.stopPropagation();
    if (selection && onAskAi) {
      const message = prompt 
        ? `${prompt}\n\n"${selection.text}"`
        : selection.text;
      onAskAi(message);
      setSelection(null);
      setShowQuickPrompts(false);
    }
  }, [selection, onAskAi]);

  const toggleQuickPrompts = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowQuickPrompts(prev => !prev);
  }, []);

  if (!selection) return null;

  // 计算工具栏位置（移动端优化）
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const toolbarTop = isMobile 
    ? Math.max(80, selection.rect.top - 70)
    : Math.max(60, selection.rect.top - 60);
  const toolbarLeft = selection.rect.left + selection.rect.width / 2;

  return (
    <AnimatePresence>
      <motion.div
        ref={toolbarRef}
        initial={{ opacity: 0, y: 10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className="fixed z-[60] pointer-events-auto"
        style={{
          top: `${toolbarTop}px`,
          left: `${Math.min(Math.max(120, toolbarLeft), window.innerWidth - 120)}px`,
          transform: 'translateX(-50%)',
        }}
      >
        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden min-w-[240px] md:min-w-0">
          {/* Main Toolbar */}
          <div className="flex items-center gap-1 p-1.5">
            {/* Save as Concept */}
            <button
              onClick={handleSaveConcept}
              className="px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors flex items-center gap-2 touch-manipulation active:scale-95"
            >
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">保存笔记</span>
              <span className="sm:hidden">保存</span>
            </button>

            {/* Divider */}
            <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-700" />

            {/* Ask AI Button */}
            <button
              onClick={toggleQuickPrompts}
              className="px-3 py-2 text-sm font-medium bg-indigo-500 text-white hover:bg-indigo-600 rounded-lg transition-colors flex items-center gap-2 touch-manipulation active:scale-95"
            >
              <Sparkles className="w-4 h-4" />
              Ask AI
            </button>
          </div>

          {/* Quick Prompts */}
          <AnimatePresence>
            {showQuickPrompts && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="border-t border-zinc-200 dark:border-zinc-800 overflow-hidden"
              >
                <div className="p-2 space-y-1">
                  <div className="text-xs text-zinc-500 px-2 py-1">快速提问</div>
                  
                  {QUICK_PROMPTS.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={(e) => handleAskAi(e, item.prompt)}
                      className="w-full px-3 py-2 text-sm text-left text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors flex items-center gap-2 touch-manipulation active:scale-95"
                    >
                      <item.icon className="w-4 h-4 text-indigo-500" />
                      {item.label}
                    </button>
                  ))}

                  {/* Divider */}
                  <div className="h-px bg-zinc-200 dark:bg-zinc-700 my-1" />

                  {/* Custom Question */}
                  <button
                    onClick={(e) => handleAskAi(e)}
                    className="w-full px-3 py-2 text-sm text-left text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors flex items-center gap-2 touch-manipulation active:scale-95"
                  >
                    <MessageCircle className="w-4 h-4 text-zinc-500" />
                    自定义提问
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Arrow */}
        <div className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-white dark:border-t-zinc-900" />
      </motion.div>
    </AnimatePresence>
  );
}
