'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  PanelLeftClose, 
  PanelLeftOpen, 
  MoreVertical,
  Trash2,
  Edit3
} from 'lucide-react';
import { CopilotWidget } from '@/app/components/ai/CopilotWidget';
import { ContextSelector } from '@/app/components/ai/ContextSelector';
import { Message } from '@/app/components/ai/useCopilot';

interface Article {
  id: string;
  title: string;
  domain?: string;
  collectionId?: string;
}

interface Collection {
  id: string;
  title: string;
  type: string;
}

interface SessionClientPageProps {
  sessionId: string;
  sessionTitle: string;
  initialMessages: Message[];
  context: {
    articleIds: string[];
    collectionId?: string;
  };
  articles: Article[];
  collections: Collection[];
}

export function SessionClientPage({
  sessionId,
  sessionTitle,
  initialMessages,
  context: initialContext,
  articles,
  collections
}: SessionClientPageProps) {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [context, setContext] = useState(initialContext);
  const [showOptions, setShowOptions] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteSession = async () => {
    if (!confirm('确定要删除这个学习会话吗？此操作不可撤销。')) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/learning/sessions/${sessionId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Failed to delete session');
      
      router.push('/learning');
    } catch (error) {
      console.error('Failed to delete session:', error);
      alert('删除失败，请重试');
    } finally {
      setIsDeleting(false);
      setShowOptions(false);
    }
  };

  return (
    <div className="h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-50 flex overflow-hidden">
      {/* Sidebar - Context Selector */}
      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <motion.aside 
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="h-full border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 z-20 flex-shrink-0 overflow-y-auto"
          >
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
              <h2 className="font-medium text-sm text-zinc-500 uppercase tracking-wider">
                学习材料
              </h2>
            </div>
            <ContextSelector 
              articles={articles}
              collections={collections}
              selectedContext={context}
              onContextChange={setContext}
            />
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-black relative">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 flex-shrink-0">
          <div className="w-full px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors text-zinc-500"
              >
                {isSidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
              </button>
              
              <button
                onClick={() => router.push('/learning')}
                className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors text-zinc-500"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              <h1 className="font-medium text-sm truncate max-w-md">
                {sessionTitle}
              </h1>
            </div>
            
            {/* Options Menu */}
            <div className="relative">
              <button 
                onClick={() => setShowOptions(!showOptions)}
                className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors text-zinc-500"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              <AnimatePresence>
                {showOptions && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden z-50"
                  >
                    <button
                      onClick={handleDeleteSession}
                      disabled={isDeleting}
                      className="w-full px-4 py-3 text-left flex items-center gap-3 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="text-sm">
                        {isDeleting ? '删除中...' : '删除会话'}
                      </span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>
       
        {/* Chat Area */}
        <main className="flex-1 overflow-hidden relative">
          <CopilotWidget 
            sessionId={sessionId}
            mode="tutor"
            variant="full"
            context={context}
            initialMessages={initialMessages}
          />
        </main>
      </div>
    </div>
  );
}
