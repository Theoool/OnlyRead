"use client";

import { useRouter } from "next/navigation";
import { Check } from "lucide-react";

interface Article {
  id: string;
  title: string;
  progress: number;
  order?: number;
}

interface Collection {
  id: string;
  title: string;
  articles?: Article[];
}

interface ChapterListSidebarProps {
  collection: Collection;
  currentArticleId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ChapterListSidebar({
  collection,
  currentArticleId,
  isOpen,
  onClose,
}: ChapterListSidebarProps) {
  const router = useRouter();

  const handleChapterClick = (articleId: string) => {
    router.push(`/read?id=${articleId}`);
    onClose();
  };

  if (!collection.articles) {
    return null;
  }

  const chapters = collection.articles
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map((article, index) => ({
      ...article,
      chapterNumber: index + 1,
      isCompleted: article.progress >= 99,
    }));

  return (
    <>
      {isOpen && (
        <div className="fixed top-[140px] right-6 md:right-12 z-50 w-[280px] max-h-[70vh] pointer-events-auto">
          <div className="bg-white/90 dark:bg-black/90 backdrop-blur-md rounded-2xl shadow-lg border border-zinc-200/60 dark:border-zinc-800/60 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200/50 dark:border-zinc-800/50">
              <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
                章节列表 ({chapters.length})
              </span>
              <button
                onClick={onClose}
                className="text-[10px] font-mono text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
              >
                关闭
              </button>
            </div>
            <div className="max-h-[calc(70vh-44px)] overflow-y-auto no-scrollbar p-2">
              {chapters.map((chapter) => (
                <button
                  key={chapter.id}
                  onClick={() => handleChapterClick(chapter.id)}
                  className={`w-full text-left rounded-lg px-3 py-2.5 transition-colors text-xs flex items-center gap-2 ${
                    chapter.id === currentArticleId
                      ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-900/60 dark:text-zinc-50'
                      : 'text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900/30'
                  }`}
                >
                  <span className="w-5 h-5 flex items-center justify-center rounded-md bg-zinc-200 dark:bg-zinc-800 text-[10px] font-mono shrink-0">
                    {chapter.chapterNumber}
                  </span>
                  <span className="flex-1 truncate">{chapter.title}</span>
                  {chapter.isCompleted && (
                    <Check className="w-3 h-3 text-green-600 dark:text-green-400 shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
