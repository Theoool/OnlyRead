"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, BookOpen } from "lucide-react";

interface SelectionToolbarProps {
  onActivate: (selection: string, rect: DOMRect) => void;
  disabled?: boolean;
}

// 防抖延迟 (ms)
const DEBOUNCE_DELAY = 150;
// 最小选择长度
const MIN_LENGTH = 1;
// 最大选择长度
const MAX_LENGTH = 100;

export function SelectionToolbar({ onActivate, disabled }: SelectionToolbarProps) {
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
      const toolbarWidth = 80; // 估计工具栏宽度
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
  }, [disabled, isValidSelection, sanitizeSelection, isVisible]);

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
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleActivate();
              }}
              className="group flex items-center gap-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black px-4 py-2 rounded-full shadow-lg hover:scale-105 transition-transform active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400 group-hover:animate-pulse" />
              <span className="text-xs font-medium">概念</span>
            </button>

            {/* 显示选择文本长度提示（可选） */}
            {selectionText.length > 20 && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-zinc-800 dark:bg-zinc-700 text-white text-[10px] px-2 py-1 rounded-full shadow-lg"
              >
                {selectionText.length} 字符
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
