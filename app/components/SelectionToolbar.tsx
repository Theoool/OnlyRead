"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";

interface SelectionToolbarProps {
  onActivate: (selection: string, rect: DOMRect) => void;
  disabled?: boolean;
}

export function SelectionToolbar({ onActivate, disabled }: SelectionToolbarProps) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [selectionText, setSelectionText] = useState("");

  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        setPosition(null);
        return;
      }

      const text = selection.toString().trim();
      // Validation (1-6 Chinese or 2-20 English)
      const isChinese = /^[\u4e00-\u9fa5]{1,6}$/.test(text);
      const isEnglish = /^[a-zA-Z\s]{2,20}$/.test(text);

      if ((isChinese || isEnglish) && !disabled) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        // Position above the selection
        setPosition({
            top: rect.top - 40, // 40px above
            left: rect.left + (rect.width / 2) - 20, // Center horizontally
        });
        setSelectionText(text);
      } else {
        setPosition(null);
      }
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    // Also listen to mouseup to capture end of drag
    document.addEventListener("mouseup", handleSelectionChange);
    
    return () => {
        document.removeEventListener("selectionchange", handleSelectionChange);
        document.removeEventListener("mouseup", handleSelectionChange);
    };
  }, [disabled]);

  if (!position) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.8 }}
      style={{ top: position.top, left: position.left }}
      className="fixed z-50"
    >
      <button
        onClick={(e) => {
            e.stopPropagation();
            // Pass the selection rect so we can spawn the card exactly there
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
                onActivate(selectionText, selection.getRangeAt(0).getBoundingClientRect());
            }
            setPosition(null); // Hide toolbar
        }}
        className="group flex items-center gap-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black px-3 py-1.5 rounded-full shadow-lg hover:scale-105 transition-transform active:scale-95"
      >
        <Sparkles className="w-3 h-3 text-purple-400 group-hover:animate-pulse" />
        <span className="text-xs font-medium">Concept</span>
      </button>
    </motion.div>
  );
}
