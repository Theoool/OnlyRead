'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Sparkles, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { CopilotWidget } from '@/app/components/ai/CopilotWidget';
import { ContextSelector } from '@/app/components/ai/ContextSelector';
import { motion, AnimatePresence } from 'framer-motion';

interface QAClientPageProps {
  articles: any[];
  collections: any[];
}

export default function QAClientPage({ articles, collections }: QAClientPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const initialArticleIds = useMemo(
    () => searchParams.get('articleIds')?.split(',').filter(Boolean) || [],
    [searchParams],
  );
  const initialCollectionId = useMemo(
    () => searchParams.get('collectionId') || undefined,
    [searchParams],
  );
  const initialSessionIdFromUrl = useMemo(
    () => searchParams.get('sessionId') || undefined,
    [searchParams],
  );
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [context, setContext] = useState<{
    articleIds: string[];
    collectionId?: string;
  }>({
    articleIds: initialArticleIds,
    collectionId: initialCollectionId
  });
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionIdFromUrl);

  const contextKey = useMemo(() => {
    if (context.collectionId) return `c:${context.collectionId}`;
    if (context.articleIds.length > 0) {
      const ids = [...context.articleIds].filter(Boolean).sort();
      return `a:${ids.join(',')}`;
    }
    return 'none';
  }, [context.collectionId, context.articleIds]);

  const didInitFromUrlRef = useRef(false);
  useEffect(() => {
    let cancelled = false;

    const ensureSession = async () => {
      const storageKey = `qa:session:${contextKey}`;
      const isFirstRun = !didInitFromUrlRef.current;
      let nextSessionId: string | undefined = undefined;

      if (typeof window !== 'undefined') {
        const stored = window.localStorage.getItem(storageKey) || undefined;

        if (isFirstRun && initialSessionIdFromUrl) {
          nextSessionId = initialSessionIdFromUrl;
          window.localStorage.setItem(storageKey, initialSessionIdFromUrl);
          didInitFromUrlRef.current = true;
        } else if (stored) {
          nextSessionId = stored;
        }
      }

      if (!nextSessionId) {
        try {
          const res = await fetch('/api/learning/sessions', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ context }),
          });
          if (!res.ok) throw new Error('Failed to create session');
          const data = await res.json();
          nextSessionId = typeof data?.id === 'string' ? data.id : undefined;
        } catch {
          nextSessionId =
            typeof crypto !== 'undefined' && crypto.randomUUID
              ? crypto.randomUUID()
              : Math.random().toString(36).substring(2) + Date.now().toString(36);
        }

        if (typeof window !== 'undefined' && nextSessionId) {
          window.localStorage.setItem(storageKey, nextSessionId);
        }
      }

      if (cancelled) return;
      if (nextSessionId && nextSessionId !== sessionId) {
        setSessionId(nextSessionId);
      }
    };

    ensureSession();
    return () => {
      cancelled = true;
    };
  }, [contextKey, context, initialSessionIdFromUrl, sessionId]);

  // Sync state -> URL (session + context)
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());

    if (sessionId) {
      params.set('sessionId', sessionId);
    } else {
      params.delete('sessionId');
    }

    if (context.articleIds.length > 0) {
        params.set('articleIds', context.articleIds.join(','));
    } else {
        params.delete('articleIds');
    }

    if (context.collectionId) {
        params.set('collectionId', context.collectionId);
    } else {
        params.delete('collectionId');
    }

    // Only push if params changed to avoid loop/noise
    const currentStr = searchParams.toString();
    const newStr = params.toString();
    if (currentStr !== newStr) {
        router.replace(`?${newStr}`);
    }
  }, [context, sessionId, router, searchParams]);

  return (
    <div className="h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-50 font-sans flex overflow-hidden">
      
      {/* Sidebar - Context Selector */}
      <AnimatePresence mode="wait">
        {isSidebarOpen && (
            <motion.aside 
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 280, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                className="h-full border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 z-20 flex-shrink-0"
            >
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
                <h1 className="font-bold text-sm tracking-wider uppercase flex items-center gap-2">
                    <Sparkles className="w-4 h-4  " />
                    Knowledge Chat
                </h1>
            </div>
            
            <button 
              onClick={() => router.back()}
              className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-zinc-500"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          </div>
        </header>
       
        {/* Chat Area */}
        <main className="flex-1 overflow-hidden relative">
         
            {sessionId ? (
                <CopilotWidget 
                    sessionId={sessionId}
                    // mode="qa" 
                    variant="full"
                    context={context}
                />
            ) : (
                <div className="flex h-full items-center justify-center">
                    <span className="loading loading-spinner text-zinc-400">Initializing session...</span>
                </div>
            )}
        </main>
      </div>
    </div>
  );
}
