import React from 'react';
import { BookOpen, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface Source {
  title: string;
  articleId: string;
  url?: string;
  similarity?: number;
}

interface SourceListProps {
  sources: Source[];
}

export function SourceList({ sources }: SourceListProps) {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-2 space-y-2">
      <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1">
        Sources
      </div>
      <div className="flex flex-wrap gap-2">
        {sources.map((source, idx) => (
          <SourceCard key={`${source.articleId}-${idx}`} source={source} index={idx + 1} />
        ))}
      </div>
    </div>
  );
}

function SourceCard({ source, index }: { source: Source; index: number }) {
  // If we have an articleId, link to the reader
  const href = source.articleId ? `/read?id=${source.articleId}` : source.url;
  
  const CardContent = (
    <div className="flex items-center gap-2 max-w-[200px]">
        <div className="flex-shrink-0 w-4 h-4 bg-zinc-100 dark:bg-zinc-800 rounded text-[10px] flex items-center justify-center font-mono text-zinc-500">
            {index}
        </div>
        <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate" title={source.title}>
                {source.title}
            </div>
        </div>
    </div>
  );

  if (href) {
    return (
      <Link 
        href={href}
        className="inline-block bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2 py-1.5 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
      >
        {CardContent}
      </Link>
    );
  }

  return (
    <div className="inline-block bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2 py-1.5 opacity-80 cursor-default">
      {CardContent}
    </div>
  );
}
