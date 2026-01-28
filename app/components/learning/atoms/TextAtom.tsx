import React from 'react';
import ReactMarkdown from 'react-markdown';
import { motion } from 'framer-motion';

interface TextAtomProps {
  content: string;
  className?: string;
  variant?: 'normal' | 'muted' | 'highlight';
}

export const TextAtom: React.FC<TextAtomProps> = ({ content, className, variant = 'normal' }) => {
  const baseStyles = "prose prose-zinc dark:prose-invert max-w-none transition-colors duration-300";
  const variantStyles = {
    normal: "text-zinc-800 dark:text-zinc-200",
    muted: "text-zinc-500 dark:text-zinc-400 text-sm",
    highlight: "text-blue-600 dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-900/20 px-1 rounded"
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
    >
      <ReactMarkdown>{content}</ReactMarkdown>
    </motion.div>
  );
};
