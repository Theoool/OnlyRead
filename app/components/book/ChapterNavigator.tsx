"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ChapterNavigatorProps {
  prevArticleId: string | null;
  nextArticleId: string | null;
  collectionTitle?: string;
}

export function ChapterNavigator({
  prevArticleId,
  nextArticleId,
  collectionTitle,
}: ChapterNavigatorProps) {
  const router = useRouter();

  const navigateToChapter = (id: string) => {
    router.push(`/read?id=${id}`);
  };

  if (!prevArticleId && !nextArticleId) {
    return null;
  }

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
      <div className="flex items-center gap-2 bg-white/90 dark:bg-black/90 backdrop-blur-md rounded-full shadow-lg border border-zinc-200/50 dark:border-zinc-800/50 px-2 py-2">
        {prevArticleId && (
          <button
            onClick={() => navigateToChapter(prevArticleId)}
            className="flex items-center gap-2 px-4 py-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors group"
            title="上一章"
          >
            <ChevronLeft className="w-4 h-4 text-zinc-600 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100" />
            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">上一章</span>
          </button>
        )}

        <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800" />

        {nextArticleId && (
          <button
            onClick={() => navigateToChapter(nextArticleId)}
            className="flex items-center gap-2 px-4 py-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors group"
            title="下一章"
          >
            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">下一章</span>
            <ChevronRight className="w-4 h-4 text-zinc-600 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100" />
          </button>
        )}
      </div>
    </div>
  );
}
