"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Check, ChevronRight, List, Loader2, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { twMerge } from "tailwind-merge";
import type { Article } from "@/lib/core/reading/articles.service";
import type { Collection } from "@/lib/core/reading/collections.service";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";

// Components
import { ReaderView } from "./components/ReaderView";
import { SimpleReaderHeader } from "./components/SimpleReaderHeader";
import { ReaderFooter } from "./components/ReaderFooter";
import { ChapterNavigator } from "@/app/components/book/ChapterNavigator";
import { ChapterListSidebar } from "@/app/components/book/ChapterListSidebar";
import { ConceptCard } from "@/app/components/ConceptCard";
import { SelectionToolbar } from "@/app/components/SelectionToolbar";
import { AISidebar } from "@/app/components/ai/AISidebar";
import { ConceptHud } from "@/app/components/ConceptHud";

// Hooks
import { useReadingLogic } from "./hooks/useReadingLogic";
import { useConceptStore, ConceptData } from "@/lib/store/useConceptStore";
import { useIsMobile } from "@/lib/hooks/use-device";
import dynamic from "next/dynamic";

// Dynamic Imports removed as we are unifying to ReaderView
const EpubReader = dynamic(() => import("./EpubReader").then(m => m.EpubReader), { ssr: false });
// const PdfReader = dynamic(() => import("./PdfReader").then(m => m.PdfReader), { ssr: false });

interface ReaderClientProps {
  initialArticle?: Article;
  initialCollection?: Collection;
}

export default function ReaderClient({ initialArticle, initialCollection }: ReaderClientProps) {
  const searchParams = useSearchParams();

  const localId = searchParams.get("localId");
  if (localId) {
    return <LocalBookReader localId={localId} />;
  }

  return <RemoteArticleReader initialArticle={initialArticle} initialCollection={initialCollection} />;
}

function LocalBookReader({ localId }: { localId: string }) {
  const localBook = useLiveQuery(() => db.books.get(localId), [localId]);

  if (!localBook) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-zinc-50 dark:bg-black">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return <EpubReader book={localBook} />;
}

function RemoteArticleReader({
  initialArticle,
  initialCollection,
}: {
  initialArticle?: Article;
  initialCollection?: Collection;
}) {
  const router = useRouter();
  const isMobile = useIsMobile();

  const [isAiSidebarOpen, setIsAiSidebarOpen] = useState(false);
  const [aiInitialMessage, setAiInitialMessage] = useState<string | undefined>(undefined);
  const [aiSelection, setAiSelection] = useState<string | undefined>(undefined);

  const handleAiToggle = () => setIsAiSidebarOpen((v) => !v);

  const handleAskAi = (text: string) => {
    setAiSelection(text);
    setAiInitialMessage(`解释这段内容：\n\n${text}`);
    setIsAiSidebarOpen(true);
  };

  const {
    article,
    sentences,
    currentIndex,
    setCurrentIndex,
    isFinished,
    setIsFinished,
    nextArticleId,
    prevArticleId,
    collection,
    tocMode,
    isCooldown,
    cooldownProgress,
    shake,
    tocItems,
    isLoadingArticle,
  } = useReadingLogic(initialArticle);

  // Use initialCollection if available
  const effectiveCollection = collection || initialCollection;

  // Compute current context text (window of 10 sentences)
  const currentContextText = useMemo(() => {
    if (!sentences || sentences.length === 0) {
      // Fallback: return article title and basic info when no sentences available
      const activeArticle = article || initialArticle;
      return activeArticle 
        ? `正在阅读: ${activeArticle.title || '未知文章'}\n文章ID: ${activeArticle.id}`
        : '当前无活动文章';
    }
    const start = Math.max(0, currentIndex - 2);
    const end = Math.min(sentences.length, currentIndex + 8);
    return sentences
      .slice(start, end)
      .map((s: any) => (typeof s === 'string' ? s : String(s?.text ?? '')))
      .filter((s: string) => s.trim().length > 0)
      .join(' ');
  }, [sentences, currentIndex, article, initialArticle]);
  
  // Concept Logic
  const { concepts, addConcept, loadConcepts } = useConceptStore();
  
  // Ensure concepts are loaded on mount
  useEffect(() => { 
    loadConcepts(); 
  }, [loadConcepts]); 

  const visibleCards = useMemo(() => {
    const activeArticle = article || initialArticle;
    if (!activeArticle || !activeArticle.content) return [];
    
    const contentLower = activeArticle.content.toLowerCase();
    const allConcepts = Object.values(concepts);
    
    return allConcepts.filter(c => {
      if (!c.term) return false;
      return contentLower.includes(c.term.toLowerCase());
    });
  }, [article, initialArticle, concepts]); 

  const [activeCard, setActiveCard] = useState<{ x: number; y: number; term: string; savedData?: ConceptData } | null>(null);
  const [isTocOpen, setIsTocOpen] = useState(false);

  const handleTermClick = (e: React.MouseEvent, term: string) => {
      const saved = concepts[term];
      if (saved) {
        const rect = (e.target as HTMLElement).getBoundingClientRect();
        setActiveCard({ x: rect.left, y: rect.top, term, savedData: saved });
      }
  };

  const handleSaveCard = async (data: ConceptData) => {
      const activeArticle = article || initialArticle;
      if (!activeArticle) return;
      try {
          await addConcept({ ...data, sourceArticleId: activeArticle.id });
          setActiveCard(null);
      } catch (error) {
          console.error('Failed to save concept:', error);
      }
  };

  if (isLoadingArticle && !initialArticle) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-zinc-50 dark:bg-black">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  const activeArticle = article || initialArticle;
  if (!activeArticle) return null;

  const progress = sentences.length > 0 ? ((currentIndex + 1) / sentences.length) * 100 : 0;

  return (
    <div className="h-screen w-full bg-[#FAFAFA] dark:bg-black text-zinc-900 dark:text-zinc-50 font-sans overflow-hidden flex flex-row selection:bg-zinc-900 selection:text-white dark:selection:bg-white dark:selection:text-black relative">
       
      <div className="flex-1 flex flex-col min-w-0 relative h-full">
          {/* Noise Texture */}
          <div className="absolute inset-0 opacity-[0.015] pointer-events-none z-0 mix-blend-multiply dark:mix-blend-overlay"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
          />

          {effectiveCollection ? (
            <>
            
              {/* Floating TOC Toggle for Book Mode */}
              <div className={twMerge(
                "fixed z-50 flex items-center gap-2",
                isMobile ? "top-2.5 sm:top-3 right-2.5 sm:right-3" : "top-3 right-6"
              )}>
                <motion.button
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => setIsTocOpen((v) => !v)}
                    className={twMerge(
                      "pointer-events-auto flex items-center justify-center gap-2 bg-white/90 dark:bg-black/90 backdrop-blur-md rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 transition-all active:scale-95 hover:bg-white dark:hover:bg-zinc-950 shadow-sm touch-manipulation",
                      isMobile ? "min-w-[40px] min-h-[40px] sm:min-w-[44px] sm:min-h-[44px] px-2.5 py-2 sm:px-3 sm:py-2.5" : "px-3 py-2 rounded-full"
                    )}
                    type="button"
                  >
                    <List className={twMerge(isMobile ? "w-4 h-4 sm:w-5 sm:h-5" : "w-3 h-3", "text-zinc-400")} />
                    <span className={twMerge(
                      "font-mono text-zinc-500 dark:text-zinc-400",
                      isMobile ? "text-xs hidden sm:inline" : "text-[10px]"
                    )}>
                      章节
                    </span>
                  </motion.button>
                  
                  <div className="hidden md:block">
                    <ConceptHud 
                        cards={visibleCards} 
                        onTermClick={(term) => {
                            const saved = concepts[term];
                            if (saved) {
                                setActiveCard({
                                    x: window.innerWidth / 2 - 140,
                                    y: window.innerHeight / 2 - 100,
                                    term,
                                    savedData: saved
                                });
                            }
                        }}
                    />
                  </div>
              </div>
            </>
          ) : (
            <SimpleReaderHeader
                title={activeArticle.title}
                progress={progress}
                tocAvailable={tocItems.length > 0}
                onTocToggle={() => setIsTocOpen(!isTocOpen)}
                visibleCards={visibleCards}
                onTermClick={(term) => {
                    const saved = concepts[term];
                    if(saved) setActiveCard({ x: window.innerWidth/2 - 140, y: window.innerHeight/2 - 100, term, savedData: saved });
                }}
                onAiToggle={handleAiToggle}
            />
          )}
      
          
          <ReaderView
            sentences={sentences}
            currentIndex={currentIndex}
            articleType={activeArticle.type}
            visibleCards={visibleCards}
            onTermClick={handleTermClick}
            isCooldown={isCooldown}
            cooldownProgress={cooldownProgress}
            shake={shake}
          />

          <ReaderFooter />

          <ChapterNavigator prevArticleId={prevArticleId} nextArticleId={nextArticleId} />
          
          <AnimatePresence>
            {isTocOpen && (
              effectiveCollection && tocMode === 'chapters' ? (
                <ChapterListSidebar
                  collection={effectiveCollection as any}
                  currentArticleId={activeArticle.id}
                  
                  isOpen={isTocOpen}
                  onClose={() => setIsTocOpen(false)}
                />
              ) : (
                tocItems.length > 0 && (
                    <motion.aside
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 16 }}
                    className={twMerge(
                      "fixed z-50 pointer-events-auto",
                      isMobile 
                        ? "inset-2 sm:inset-3" 
                        : "top-[76px] right-6 md:right-12 w-[280px] max-h-[70vh]"
                    )}
                  >
                    <div className={twMerge(
                      "bg-white/95 dark:bg-black/95 backdrop-blur-md rounded-2xl shadow-xl border border-zinc-200/60 dark:border-zinc-800/60 overflow-hidden",
                      isMobile ? "h-full" : ""
                    )}>
                      <div className={twMerge(
                        "flex items-center justify-between border-b border-zinc-200/50 dark:border-zinc-800/50",
                        isMobile ? "px-4 py-3 sm:px-5 sm:py-4" : "px-4 py-3"
                      )}>
                        <span className={twMerge(
                          "font-mono text-zinc-500 dark:text-zinc-400",
                          isMobile ? "text-sm sm:text-xs" : "text-[10px]"
                        )}>
                          目录
                        </span>
                        <button
                          onClick={() => setIsTocOpen(false)}
                          className={twMerge(
                            "font-mono text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors touch-manipulation",
                            isMobile ? "text-sm sm:text-xs min-w-[40px] min-h-[40px] sm:min-w-[44px] sm:min-h-[44px] -mr-1 sm:-mr-2" : "text-[10px]"
                          )}
                          type="button"
                        >
                          关闭
                        </button>
                      </div>
                      <div className={twMerge(
                        "overflow-y-auto no-scrollbar",
                        isMobile ? "max-h-[calc(100%-52px)] sm:max-h-[calc(100%-60px)] p-2 sm:p-3" : "max-h-[calc(70vh-44px)] p-2"
                      )}>
                        {tocItems.map((item, i) => (
                          <button
                            key={`${item.index}-${i}`}
                            onClick={() => {
                              setCurrentIndex(item.index);
                              setIsTocOpen(false);
                            }}
                            className={twMerge(
                              "w-full text-left rounded-lg transition-all touch-manipulation active:scale-98",
                              isMobile ? "px-2.5 py-2.5 sm:px-3 sm:py-3 text-sm mb-1.5 sm:mb-2" : "px-2 py-2 text-xs",
                              item.index <= currentIndex && (tocItems[i+1]?.index > currentIndex || i === tocItems.length-1)
                                ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-900/60 dark:text-zinc-50 font-medium"
                                : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900/30"
                            )}
                            style={{ paddingLeft: (isMobile ? 10 : 8) + Math.max(0, item.depth - 1) * (isMobile ? 14 : 12) }}
                          >
                            {item.text}
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.aside>
                )
              )
            )}
          </AnimatePresence>
          
          <SelectionToolbar 
            onActivate={(text, rect) => {
                const saved = concepts[text];
                if (saved) {
                    setActiveCard({ x: rect.left, y: rect.top, term: text, savedData: saved });
                    return;
                }
                if (visibleCards.length >= 5) return;
                setActiveCard({ x: rect.left, y: rect.top, term: text });
            }}
            disabled={!!activeCard} 
            onAskAi={handleAskAi}
          />
          
        
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

          <AnimatePresence>
            {isFinished && (
                <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="fixed inset-0 z-[100] flex items-center justify-center bg-white/80 dark:bg-black/80 backdrop-blur-xl p-4 md:p-6"
              >
                <div className="bg-white dark:bg-zinc-900 p-6 md:p-8 rounded-2xl md:rounded-3xl shadow-2xl border border-zinc-100 dark:border-zinc-800 max-w-sm w-full text-center">
                    <div className="w-14 h-14 md:w-16 md:h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-5 md:mb-6">
                        <Check className="w-7 h-7 md:w-8 md:h-8 text-zinc-900 dark:text-zinc-100" />
                    </div>
                    <h2 className="text-xl md:text-2xl font-serif font-medium mb-2">阅读完成</h2>
                    <p className="text-zinc-500 dark:text-zinc-400 mb-6 md:mb-8 text-sm md:text-base">
                        你已经完成了这次深度阅读。
                    </p>
                      <div className="space-y-3">
                      {nextArticleId && (
                          <button
                            onClick={() => {
                              router.replace(`/read?id=${nextArticleId}`)
                              setIsFinished(false)
                            }}
                            className="w-full min-h-[48px] md:min-h-[44px] py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black rounded-xl md:rounded-xl font-medium hover:opacity-90 active:scale-98 transition-all flex items-center justify-center gap-2 touch-manipulation text-base md:text-sm"
                          >
                            下一章 <ChevronRight className="w-5 h-5 md:w-4 md:h-4" />
                          </button>
                      )}
                      <button 
                        onClick={() => router.replace("/")} 
                        className="w-full min-h-[48px] md:min-h-[44px] py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl md:rounded-xl font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-98 transition-all touch-manipulation text-base md:text-sm"
                      >
                        返回首页
                      </button>
                      </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
      </div>

      <AISidebar 
          isOpen={isAiSidebarOpen} 
          onClose={() => {
            setIsAiSidebarOpen(false)
            setAiInitialMessage(undefined)
            setAiSelection(undefined)
          }}
          context={{ 
              articleIds: [activeArticle.id],
              collectionId: effectiveCollection?.id,
              selection: aiSelection,
              currentContent: currentContextText
          }}
          initialMessage={aiInitialMessage}
          layoutMode="flat"
      />
    </div>
  );
}
