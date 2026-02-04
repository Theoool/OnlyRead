"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, BookOpen } from "lucide-react";

interface SelectionToolbarProps {
  onActivate: (selection: string, rect: DOMRect) => void;
  onAskAi?: (selection: string) => void;
  disabled?: boolean;
}

// 防抖延迟 (ms)
const DEBOUNCE_DELAY = 150;
// 最小选择长度
const MIN_LENGTH = 1;
// 最大选择长度
const MAX_LENGTH = 200; // Increased to allow longer questions context

export function SelectionToolbar({ onActivate, onAskAi, disabled }: SelectionToolbarProps) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [selectionText, setSelectionText] = useState("");
  const [isVisible, setIsVisible] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastSelectionRef = useRef<string>("");

  /**
   * 验证选择文本是否有效
   * 支持：中文、英文、数字、常见标点符号
   */
  const isValidSelection = useCallback((text: string): boolean => {
    if (!text || text.length < MIN_LENGTH || text.length > MAX_LENGTH) {
      return false;
    }

    // 检查是否包含至少一个有效字符（中文、英文字母、数字）
    const hasValidChar = /[\u4e00-\u9fa5a-zA-Z0-9]/.test(text);
    if (!hasValidChar) return false;

    // 检查是否包含过多特殊字符（可能是代码或其他格式）
    const specialCharRatio = (text.match(/[^\u4e00-\u9fa5a-zA-Z0-9\s\-_.,;:!?"'()[\]{}]/g) || []).length / text.length;
    if (specialCharRatio > 0.5) return false;

    return true;
  }, []);

  /**
   * 清理选择文本
   */
  const sanitizeSelection = useCallback((text: string): string => {
    return text
      .trim()
      // 移除多余的空白字符
      .replace(/\s+/g, " ")
      // 移除首尾标点
      .replace(/^[\s.,;:!?"'()[\]{}]+|[\s.,;:!?"'()[\]{}]+$/g, "");
  }, []);

  const handleSelectionChange = useCallback(() => {
    if (disabled) {
      setIsVisible(false);
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setIsVisible(false);
      return;
    }

    const rawText = selection.toString();
    const text = sanitizeSelection(rawText);

    // 如果和上次选择相同，不重新计算
    if (text === lastSelectionRef.current && isVisible) {
      return;
    }

    if (isValidSelection(text)) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      // 计算位置：在选择上方居中
      const toolbarWidth = onAskAi ? 160 : 80; // Adjust width based on buttons
      const left = Math.max(16, rect.left + rect.width / 2 - toolbarWidth / 2);
      const top = Math.max(16, rect.top - 50); // 50px 上方

      // 确保不超出视口
      const viewportWidth = window.innerWidth;
      const finalLeft = Math.min(left, viewportWidth - toolbarWidth - 16);

      setPosition({ top, left: finalLeft });
      setSelectionText(text);
      setIsVisible(true);
      lastSelectionRef.current = text;
    } else {
      setIsVisible(false);
    }
  }, [disabled, isValidSelection, sanitizeSelection, isVisible, onAskAi]);

  useEffect(() => {
    const debouncedHandler = () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(handleSelectionChange, DEBOUNCE_DELAY);
    };

    document.addEventListener("selectionchange", debouncedHandler);
    document.addEventListener("mouseup", debouncedHandler);
    // 滚动时隐藏
    document.addEventListener("scroll", () => setIsVisible(false), true);

    return () => {
      document.removeEventListener("selectionchange", debouncedHandler);
      document.removeEventListener("mouseup", debouncedHandler);
      document.removeEventListener("scroll", () => setIsVisible(false), true);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [handleSelectionChange]);

  const handleActivate = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      onActivate(selectionText, rect);
      setIsVisible(false);
      lastSelectionRef.current = "";
    }
  }, [onActivate, selectionText]);

  const handleAskAi = useCallback(() => {
    if (onAskAi) {
        onAskAi(selectionText);
        setIsVisible(false);
        lastSelectionRef.current = "";
    }
  }, [onAskAi, selectionText]);

  return (
    <AnimatePresence>
      {isVisible && position && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.8 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          style={{ top: position.top, left: position.left }}
          className="fixed z-50"
        >
          <div className="flex items-center gap-1 bg-white dark:bg-black rounded-lg p-1 shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-zinc-200 dark:border-zinc-800 backdrop-blur-sm">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleActivate();
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors text-zinc-700 dark:text-zinc-300"
            >
              <BookOpen className="w-4 h-4 text-purple-500" />
              <span className="text-sm font-medium">Concept</span>
            </button>
            
            {onAskAi && (
                <>
                    <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-800 mx-1" />
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleAskAi();
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors text-zinc-700 dark:text-zinc-300"
                    >
                        <Sparkles className="w-4 h-4 text-indigo-500" />
                        <span className="text-sm font-medium">Ask AI</span>
                    </button>
                </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
