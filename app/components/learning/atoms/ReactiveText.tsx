import React from 'react';
import { AtomProps } from './types';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

// Helper to interpolate string with state values
const interpolate = (template: string, state: any) => {
    return template.replace(/\{\{state\.([^}]+)\}\}/g, (_, path) => {
        const parts = path.split('.');
        return parts.reduce((acc: any, part: string) => acc && acc[part], state) ?? '';
    });
};

export const ReactiveText: React.FC<AtomProps> = ({ atom, state }) => {
  if (atom.type !== 'text') return null;

  const text = interpolate(atom.content, state);

  const Tag = atom.variant === 'h1' ? 'h1' : 
              atom.variant === 'h2' ? 'h2' : 
              atom.variant === 'h3' ? 'h3' : 'div'; // Changed p to div to allow flex children if needed

  // Detect if content contains dynamic numbers for highlighting
  // Simple heuristic: if text changes frequently, we might want to animate it.
  // For now, we just animate the whole block on change.

  return (
    <Tag className={cn(
        atom.variant === 'h1' && "text-3xl font-bold tracking-tight",
        atom.variant === 'h2' && "text-2xl font-semibold tracking-tight",
        atom.variant === 'h3' && "text-lg font-medium",
        atom.variant === 'p' && "text-base leading-relaxed",
        atom.variant === 'muted' && "text-sm text-zinc-500",
        "text-zinc-900 dark:text-zinc-100 transition-colors",
        atom.className
    )}>
        <AnimatePresence mode="wait">
            <motion.span
                key={text} // Re-render when text changes
                initial={{ opacity: 0.8, y: 2 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
                className="inline-block"
            >
                {/* Basic Markdown-like bold parsing */}
                {text.split('**').map((part, i) => 
                    i % 2 === 1 ? <strong key={i} className="font-semibold text-indigo-600 dark:text-indigo-400">{part}</strong> : part
                )}
            </motion.span>
        </AnimatePresence>
    </Tag>
  );
};
