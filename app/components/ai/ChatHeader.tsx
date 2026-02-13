'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

interface ChatHeaderProps {
  session?: {
    title: string | null;
    mode: string;
    status: string;
  };
}

const MODE_STYLES = {
  QA: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  TUTOR: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  COPILOT: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
} as const;

const MODE_LABELS = {
  QA: '问答',
  TUTOR: '导师',
  COPILOT: '助手',
} as const;

export const ChatHeader = memo(function ChatHeader({ session }: ChatHeaderProps) {
  if (!session) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
        <span className="text-sm text-zinc-500">加载中...</span>
      </div>
    );
  }

  const mode = session.mode as keyof typeof MODE_STYLES;

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <h2 className="font-medium text-sm truncate max-w-md">
          {session.title || '新对话'}
        </h2>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${MODE_STYLES[mode] || MODE_STYLES.COPILOT}`}>
          {MODE_LABELS[mode] || mode}
        </span>
      </div>
    </div>
  );
});

