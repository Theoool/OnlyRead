"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { LocalBook } from '@/lib/db';
import { useTheme } from 'next-themes';
import { Loader2, MessageSquare, BookOpen, Cloud, CloudOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useConceptStore, ConceptData } from '@/lib/store/useConceptStore';
import { ConceptCard } from '@/app/components/ConceptCard';
import { twMerge } from 'tailwind-merge';
import { EpubView } from 'react-reader';
import { SimpleReaderHeader } from "./components/SimpleReaderHeader";
import { ReaderFooter } from "./components/ReaderFooter";
import { AISidebarEphemeral as AISidebar } from "@/app/components/ai/AISidebarEphemeral";
import { ImportProgressDisplay } from "@/app/components/import/import-progress-display";
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';

interface EpubReaderProps {
  book: LocalBook;
}

export function EpubReader({ book }: EpubReaderProps) {
  const [location, setLocation] = useState<string | number>(0);
  const [progress, setProgress] = useState(0);
  const [toc, setToc] = useState<any[]>([]);
  const renditionRef = useRef<any>(null);
  const [isTocOpen, setIsTocOpen] = useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [copilotInitialMessage, setCopilotInitialMessage] = useState<string | undefined>(undefined);
  const router = useRouter();
  const { theme } = useTheme();
  
  // 实时监听 book 的同步状态变化
  const liveBook = useLiveQuery(() => db.books.get(book.id), [book.id]);
  const currentBook = liveBook || book;

  // Toolbar State
  const [toolbarState, setToolbarState] = useState<{
    isVisible: boolean;
    position: { top: number; left: number };
    text: string;
    cfiRange: string;
  }>({
    isVisible: false,
    position: { top: 0, left: 0 },
    text: '',
    cfiRange: ''
  });

  // Concept Store
  const { concepts, addConcept } = useConceptStore();
  const [activeCard, setActiveCard] = useState<{ x: number; y: number; term: string; savedData?: ConceptData } | null>(null);

  // Copilot Context
  const [copilotContext, setCopilotContext] = useState<{
      articleIds: string[];
      collectionId?: string;
      selection?: string;
  }>({
      articleIds: [],
      collectionId: undefined,
      selection: undefined
  });

  // Convert copilotContext to AISidebarEphemeral context format
  const sidebarContext = useMemo(() => ({
      articleTitle: book.title,
      selection: copilotContext.selection
  }), [book.title, copilotContext.selection]);

  // Set Copilot context when book loads
  useEffect(() => {
    if (book.id) {
        setCopilotContext(prev => ({ ...prev, articleIds: [book.id] }));
    }
  }, [book.id]);

  // Calculate visible cards
  const visibleCards = useMemo(() => {
    return Object.values(concepts);
  }, [concepts]);

  // Update theme styles
  const updateTheme = useCallback((rendition: any) => {
    if (!rendition || !rendition.themes) {
      console.warn('Rendition or themes not available');
      return;
    }
    
    try {
      const isDark = theme === 'dark';
      const textColor = isDark ? '#E4E4E7' : '#27272A'; // zinc-200 : zinc-800
      const bg = isDark ? '#000000' : '#FAFAFA';

      rendition.themes.register('custom', {
         body: {
           color: textColor,
           background: bg,
           'font-family': 'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"',
           'padding-top': '40px !important',
           'padding-bottom': '40px !important',
           'padding-left': '20px !important',
           'padding-right': '20px !important',
           'max-width': '768px !important', // Match max-w-3xl
           'margin': '0 auto !important',
         },
         'p': {
           'font-size': '1.125rem !important',
           'line-height': '1.8 !important',
           'text-align': 'justify !important',
           'margin-bottom': '1.5em !important'
         },
         'h1': { 'font-family': 'serif', 'margin-top': '2em', 'font-weight': '700' },
         'h2': { 'font-family': 'serif', 'margin-top': '1.5em', 'font-weight': '700' },
         'h3': { 'font-family': 'serif', 'margin-top': '1.2em', 'font-weight': '700' },
         'img': { 'max-width': '100%', 'border-radius': '0.5rem' },
         '::selection': {
             'background': isDark ? 'rgba(168, 85, 247, 0.4)' : 'rgba(168, 85, 247, 0.2)'
         }
      });
      rendition.themes.select('custom');
    } catch (error) {
      console.error('Error applying theme:', error);
    }
  }, [theme]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const rendition = renditionRef.current;
      if (!rendition) return;

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case ' ':
          e.preventDefault();
          rendition.next();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          rendition.prev();
          break;
        case 'Escape':
          e.preventDefault();
          setIsTocOpen(false);
          setActiveCard(null);
          setToolbarState(prev => ({ ...prev, isVisible: false }));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Update theme when changed
  useEffect(() => {
      if (renditionRef.current) {
          updateTheme(renditionRef.current);
      }
  }, [theme, updateTheme]);

  // Handle selection activation
  const handleSelectionActivate = useCallback((text: string, rect: { x: number, y: number }, cfiRange: string) => {
    if (!text || text.trim().length < 1 || text.length > 100) return;

    const saved = concepts[text];
    setActiveCard({
        x: rect.x,
        y: rect.y,
        term: text,
        savedData: saved
    });
    
    setToolbarState(prev => ({ ...prev, isVisible: false }));
  }, [concepts]);

  // Handle Ask AI
  const handleAskAI = useCallback((text: string) => {
      setCopilotContext(prev => ({ ...prev, selection: text }));
      setCopilotInitialMessage(`解释这段内容：\n\n${text}`);
      setIsCopilotOpen(true);
      setToolbarState(prev => ({ ...prev, isVisible: false }));
  }, []);

  // Save concept
  const handleSaveCard = useCallback(async (data: ConceptData) => {
      try {
          await addConcept({
              ...data,
              sourceArticleId: book.id
          });
          setActiveCard(null);

          // Clear selection in EPUB
          const rendition = renditionRef.current;
          if (rendition?.getContents) {
            const contents = rendition.getContents();
            contents.forEach((content: any) => {
              if (content?.window?.getSelection) {
                content.window.getSelection().removeAllRanges();
              }
            });
          }
      } catch (error) {
        console.error('Failed to save concept:', error);
      }
  }, [addConcept, book.id]);

  // Get selection coordinates
  const getSelectionCoordinates = useCallback((range: Range, iframe: HTMLIFrameElement) => {
    try {
      const rect = range.getBoundingClientRect();
      const iframeRect = iframe.getBoundingClientRect();

      return {
        left: rect.left + iframeRect.left,
        top: rect.top + iframeRect.top,
        width: rect.width,
        height: rect.height,
        right: rect.left + iframeRect.left + rect.width,
        bottom: rect.top + iframeRect.top + rect.height,
        x: rect.left + iframeRect.left,
        y: rect.top + iframeRect.top,
        toJSON: () => ({})
      } as DOMRect;
    } catch (error) {
      console.error('Failed to get selection coordinates:', error);
      return null;
    }
  }, []);

  if (!book.fileData) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#FAFAFA] dark:bg-black">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-[#FAFAFA] dark:bg-black text-zinc-900 dark:text-zinc-50 font-sans overflow-hidden flex flex-row selection:bg-zinc-900 selection:text-white dark:selection:bg-white dark:selection:text-black relative">
       
       <div className="flex-1 flex flex-col min-w-0 relative h-full">
           {/* Noise Texture */}
           <div className="absolute inset-0 opacity-[0.015] pointer-events-none z-0 mix-blend-multiply dark:mix-blend-overlay"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
           />

           <SimpleReaderHeader
                title={book.title}
                progress={progress}
                tocAvailable={toc.length > 0}
                onTocToggle={() => setIsTocOpen(!isTocOpen)}
                visibleCards={visibleCards}
                onTermClick={(term) => {
                    const saved = concepts[term];
                    if(saved) setActiveCard({ x: window.innerWidth/2 - 140, y: window.innerHeight/2 - 100, term, savedData: saved });
                }}
                onAiToggle={() => setIsCopilotOpen((v) => !v)}
            />

           {/* Sync Status Indicator */}
           <SyncStatusIndicator book={currentBook} />

           {/* Reader Area */}
           <div className="flex-1 w-full h-full relative z-10 overflow-hidden flex pt-[60px]">
               <div className="flex-1 relative">
                    <EpubView
                        url={book.fileData}
                        location={location}
                        locationChanged={(loc: string | number) => {
                            setLocation(loc);
                            // Update progress
                            if (renditionRef.current?.location?.start?.percentage) {
                                setProgress(renditionRef.current.location.start.percentage * 100);
                            }
                        }}
                        tocChanged={(t) => setToc(t)}
                        epubOptions={{
                            flow: 'scrolled',
                            manager: 'continuous',
                            width: '100%',
                            height: '100%',
                            allowScriptedContent: true,
                            allowPopups: true,
                        }}
                        getRendition={(rendition) => {
                            if (!rendition) {
                              console.warn('Rendition is undefined');
                              return;
                            }
                            
                            renditionRef.current = rendition;
                            
                            // Delay theme update to ensure rendition is fully initialized
                            setTimeout(() => {
                              updateTheme(rendition);
                            }, 0);
                            
                            // Initialize progress
                            rendition.on('relocated', (location: any) => {
                                if (location?.start?.percentage) {
                                    setProgress(location.start.percentage * 100);
                                }
                            });

                            // Enhanced selection handling
                            rendition.on('selected', (cfiRange: string, contents: any) => {
                                try {
                                    const selection = contents.window.getSelection();
                                    if (!selection || selection.rangeCount === 0) return;

                                    const range = selection.getRangeAt(0);
                                    const text = range.toString().trim();

                                    if (!text || text.length < 1 || text.length > 300) {
                                        setToolbarState(prev => ({ ...prev, isVisible: false }));
                                        return;
                                    }

                                    const iframes = (rendition as any).manager?.container?.querySelectorAll('iframe');
                                    if (!iframes || iframes.length === 0) return;

                                    let targetIframe: HTMLIFrameElement | null = null;
                                    for (const item of Array.from(iframes)) {
                                        const iframe = item as HTMLIFrameElement;
                                        try {
                                            if (iframe.contentWindow === contents.window) {
                                                targetIframe = iframe;
                                                break;
                                            }
                                        } catch (e) {
                                            continue;
                                        }
                                    }

                                    if (!targetIframe) return;

                                    const coords = getSelectionCoordinates(range, targetIframe);
                                    if (!coords) return;

                                    if (coords.x < 0 || coords.y < 0) return;

                                    const toolbarWidth = 160;
                                    const left = Math.max(16, coords.x + coords.width / 2 - toolbarWidth / 2);
                                    const top = Math.max(16, coords.y - 60);

                                    setToolbarState({
                                        isVisible: true,
                                        position: { top, left },
                                        text,
                                        cfiRange
                                    });

                                } catch (error) {
                                    console.error('Error handling selection:', error);
                                }
                            });

                            rendition.on('click', () => {
                                setIsTocOpen(false);
                                setToolbarState(prev => ({ ...prev, isVisible: false }));
                            });

                            rendition.on('locationChanged', () => {
                                setActiveCard(null);
                                setToolbarState(prev => ({ ...prev, isVisible: false }));
                            });
                        }}
                    />
               </div>
           </div>

           <ReaderFooter />

           {/* TOC Sidebar */}
           <AnimatePresence>
             {isTocOpen && (
               <motion.aside
                 initial={{ opacity: 0, x: 16 }}
                 animate={{ opacity: 1, x: 0 }}
                 exit={{ opacity: 0, x: 16 }}
                 className="fixed top-[76px] right-6 md:right-12 z-50 w-[280px] max-h-[70vh] pointer-events-auto"
               >
                 <div className="bg-white/90 dark:bg-black/90 backdrop-blur-md rounded-2xl shadow-lg border border-zinc-200/60 dark:border-zinc-800/60 overflow-hidden">
                   <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200/50 dark:border-zinc-800/50">
                     <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
                       目录
                     </span>
                     <button
                       onClick={() => setIsTocOpen(false)}
                       className="text-[10px] font-mono text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                       type="button"
                     >
                       关闭
                     </button>
                   </div>
                   <div className="max-h-[calc(70vh-44px)] overflow-y-auto no-scrollbar p-2">
                     {toc.length === 0 ? (
                       <div className="flex items-center justify-center py-8 text-zinc-400 text-xs">
                         暂无目录
                       </div>
                     ) : (
                       toc.map((chapter, i) => (
                         <button
                           key={i}
                           onClick={() => {
                               setLocation(chapter.href);
                               setIsTocOpen(false);
                           }}
                           className={twMerge(
                             "w-full text-left rounded-lg px-2 py-2 transition-colors text-xs text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900/30 truncate"
                           )}
                         >
                           {chapter.label}
                         </button>
                       ))
                     )}
                   </div>
                 </div>
               </motion.aside>
             )}
           </AnimatePresence>

           {/* Concept Card Modal */}
           <AnimatePresence>
              {activeCard && (
                  <ConceptCard
                      selection={activeCard.term}
                      position={{ top: activeCard.y, left: activeCard.x }}
                      savedData={activeCard.savedData}
                      onSave={handleSaveCard}
                      onClose={() => setActiveCard(null)}
                  />
              )}
           </AnimatePresence>

           {/* Selection Toolbar (Custom implementation to work with iframe) */}
           <AnimatePresence>
             {toolbarState.isVisible && !activeCard && (
               <motion.div
                 initial={{ opacity: 0, y: 10, scale: 0.8 }}
                 animate={{ opacity: 1, y: 0, scale: 1 }}
                 exit={{ opacity: 0, y: 10, scale: 0.8 }}
                 transition={{ type: "spring", stiffness: 400, damping: 25 }}
                 style={{ top: toolbarState.position.top, left: toolbarState.position.left }}
                 className="fixed z-50"
               >
                 <div className="flex items-center gap-1 bg-white dark:bg-black rounded-lg p-1 shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-zinc-200 dark:border-zinc-800 backdrop-blur-sm">
                   <button
                     onClick={(e) => {
                       e.stopPropagation();
                       handleSelectionActivate(
                         toolbarState.text, 
                         { x: toolbarState.position.left, y: toolbarState.position.top + 50 }, 
                         toolbarState.cfiRange
                       );
                     }}
                     className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors text-zinc-700 dark:text-zinc-300"
                   >
                     <BookOpen className="w-4 h-4 text-purple-500" />
                     <span className="text-sm font-medium">Concept</span>
                   </button>

                   <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-800 mx-1" />

                   <button
                     onClick={(e) => {
                        e.stopPropagation();
                        handleAskAI(toolbarState.text);
                     }}
                     className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors text-zinc-700 dark:text-zinc-300"
                   >
                     <MessageSquare className="w-4 h-4 text-indigo-500" />
                     <span className="text-sm font-medium">Ask AI</span>
                   </button>
                 </div>
               </motion.div>
             )}
           </AnimatePresence>
       </div>

       <AISidebar 
          isOpen={isCopilotOpen} 
          onClose={() => {
            setIsCopilotOpen(false)
            setCopilotInitialMessage(undefined)
          }}
          context={{ 
              articleTitle: sidebarContext.articleTitle,
              selection: sidebarContext.selection
          }}
          initialMessage={copilotInitialMessage}
          layoutMode="flat"
       />
    </div>
  );
}

// 同步状态指示器组件
function SyncStatusIndicator({ book }: { book: LocalBook }) {
  const router = useRouter();
  
  // 如果正在同步且有 jobId，显示进度组件
  if ((book.syncStatus === 'uploading' || book.syncStatus === 'processing') && book.jobId) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed top-3 left-6 z-50 max-w-md"
      >
        <ImportProgressDisplay
          jobId={book.jobId}
          onComplete={() => {
            console.log('同步完成');
          }}
          onError={(error) => {
            console.error('同步失败:', error);
          }}
        />
      </motion.div>
    );
  }
  
  // 已同步状态 - 显示切换按钮
  if (book.syncStatus === 'synced') {
    const handleSwitchToCloud = () => {
      if (book.cloudCollectionId) {
        router.push(`/read?id=${book.cloudArticleId || book.cloudCollectionId}`);
      } else if (book.cloudArticleId) {
        router.push(`/read?id=${book.cloudArticleId}`);
      }
    };

    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed top-3 left-6 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 dark:bg-green-950/30 border border-zinc-200/50 dark:border-zinc-800/50"
      >
        <Cloud className="w-3 h-3 text-green-500" />
        <span className="text-[11px] font-medium text-green-500">已同步</span>
        <button
          onClick={handleSwitchToCloud}
          className="ml-1 px-2 py-0.5 bg-white dark:bg-zinc-800 rounded text-[10px] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors border border-zinc-200 dark:border-zinc-700"
        >
          切换云端
        </button>
      </motion.div>
    );
  }
  
  // 本地模式
  if (book.syncStatus === 'local') {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed top-3 left-6 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/50 dark:border-zinc-800/50"
      >
        <CloudOff className="w-3 h-3 text-zinc-500" />
        <span className="text-[11px] font-medium text-zinc-500">本地模式</span>
      </motion.div>
    );
  }
  
  // 错误状态
  if (book.syncStatus === 'error') {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed top-3 left-6 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 dark:bg-red-950/30 border border-zinc-200/50 dark:border-zinc-800/50"
      >
        <CloudOff className="w-3 h-3 text-red-500" />
        <span className="text-[11px] font-medium text-red-500">同步失败</span>
        {book.syncError && (
          <span className="text-[10px] text-red-400 max-w-[200px] truncate">
            {book.syncError}
          </span>
        )}
      </motion.div>
    );
  }
  
  return null;
}
