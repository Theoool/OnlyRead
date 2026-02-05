import React from 'react';
import ReactMarkdown from 'react-markdown';
import { twMerge } from 'tailwind-merge';

interface TextWithCitationsProps {
  text: string;
  sources?: {
    title: string;
    articleId: string;
  }[];
  className?: string;
}

export function TextWithCitations({ text, sources, className }: TextWithCitationsProps) {
  // Simple regex to match citation patterns like [1], [2], etc.
  // We can enhance this to be interactive later
  const components = {
    // Custom renderer for text to handle citations if needed, 
    // but ReactMarkdown + remark plugins is usually better.
    // For now, let's just render the markdown.
    p: ({node, ...props}: any) => <p className="mb-2 last:mb-0" {...props} />,
    a: ({node, ...props}: any) => <a className="text-indigo-500 hover:underline" {...props} />,
    ul: ({node, ...props}: any) => <ul className="list-disc pl-4 mb-2" {...props} />,
    ol: ({node, ...props}: any) => <ol className="list-decimal pl-4 mb-2" {...props} />,
    code: ({node, inline, className, children, ...props}: any) => {
        return inline ? (
            <code className="bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded text-xs font-mono" {...props}>
                {children}
            </code>
        ) : (
            <code className="block bg-zinc-100 dark:bg-zinc-800 p-2 rounded text-xs font-mono overflow-x-auto my-2" {...props}>
                {children}
            </code>
        );
    }
  };

  // If we wanted to make [1] clickable chips:
  // We would parse `text` and replace `[n]` with a <button> component.
  // For this MVP, we rely on standard text rendering.

  return (
    <div className={twMerge("text-zinc-800 dark:text-zinc-200", className)}>
      <ReactMarkdown components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
