'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles } from 'lucide-react';
import { CopilotWidget } from '@/app/components/ai/CopilotWidget';

interface AISidebarProps {
  isOpen: boolean;
  onClose: () => void;
  context: {
    articleIds?: string[];
    collectionId?: string;
    selection?: string;
    currentContent?: string;
  };
  initialMessage?: string;
  layoutMode?: 'overlay' | 'flat';
}

export function AISidebar({ isOpen, onClose, context, initialMessage, layoutMode = 'overlay' }: AISidebarProps) {
  const SidebarContent = (
    <div className="flex flex-col h-full z-30  w-full md:w-[400px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md flex-shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          <span className="font-medium text-sm">AI Assistant</span>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Widget */}
      <div className="flex-1 overflow-hidden">
        <CopilotWidget
          mode="copilot"
          variant="sidebar"
          context={context}
          initialMessages={initialMessage ? [{
              id: 'init-1',
              role: 'user',
              content: initialMessage,
              createdAt: new Date().toISOString()
          }] : []}
        />
      </div>
    </div>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {layoutMode === 'overlay' && (
            <>
              {/* Backdrop (Mobile only) */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
              />

              {/* Sidebar */}
              <motion.aside
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed inset-y-0 right-0 z-50 w-full md:w-[400px] bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col"
              >
                {SidebarContent}
              </motion.aside>
            </>
          )}

          {layoutMode === 'flat' && (
             <motion.aside
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 400, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="h-full border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 z-40 flex flex-col flex-shrink-0 overflow-hidden"
             >
                <div className="w-[400px] h-full flex flex-col">
                    {SidebarContent}
                </div>
             </motion.aside>
          )}
        </>
      )}
    </AnimatePresence>
  );
}
