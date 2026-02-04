"use client";

import { BookOpen, Clock, Sparkles } from "lucide-react";

interface BookInfoBarProps {
  collection: {
    id: string;
    title: string;
    author?: string | null;
    totalChapters?: number;
    completedChapters?: number;
    readingProgress?: number;
  };
  article: {
    id: string;
    title: string;
    progress?: number;
  };
  currentChapter: number;
  totalChapters: number;
  bookProgress: number;
  onAiToggle?: () => void;
}

export function BookInfoBar({
  collection,
  article,
  currentChapter,
  totalChapters,
  bookProgress,
  onAiToggle,
}: BookInfoBarProps) {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-6 py-3 pointer-events-auto">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        {/* 左侧：Book标题和章节信息 */}
        <div className="flex items-center gap-4">
          <BookOpen className="w-4 h-4 text-zinc-500" />
          <div>
            <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {collection.title}
            </h1>
            <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
              <span>第 {currentChapter} / {totalChapters} 章</span>
              <span className="text-zinc-400">•</span>
              <span className="max-w-[200px] truncate">{article.title}</span>
            </div>
          </div>
        </div>

        {/* 右侧：进度条 */}
        <div className="flex items-center gap-3">
          {onAiToggle && (
              <button
                onClick={onAiToggle}
                className="p-2 mr-2 bg-white dark:bg-zinc-800 rounded-full border border-zinc-200 dark:border-zinc-700 hover:scale-105 transition-transform group"
              >
                  <Sparkles className="w-4 h-4 text-indigo-500 group-hover:animate-pulse" />
              </button>
          )}

          <div className="text-right">
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider">全书进度</div>
            <div className="text-lg font-mono font-bold text-zinc-900 dark:text-zinc-100">
              {Math.round(bookProgress)}%
            </div>
          </div>
          <div className="w-32 h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-zinc-900 dark:bg-zinc-100 transition-all duration-500 ease-out"
              style={{ width: `${bookProgress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
