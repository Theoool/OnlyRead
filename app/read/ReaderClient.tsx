"use client";
import {useState, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";

import { Loader2, List, Check, ChevronRight, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { twMerge } from "tailwind-merge";
import type { Article } from "@/lib/core/reading/articles.service";
import type { Collection } from "@/lib/core/reading/collections.service";

// Components
import { ReaderView } from "./components/ReaderView";
import { SimpleReaderHeader } from "./components/SimpleReaderHeader";
import { ReaderFooter } from "./components/ReaderFooter";
import { ChapterNavigator } from "@/app/components/book/ChapterNavigator";
import { ChapterListSidebar } from "@/app/components/book/ChapterListSidebar";
import { BookInfoBar } from "@/app/components/book/BookInfoBar";
import { ConceptCard } from "@/app/components/ConceptCard";
import { SelectionToolbar } from "@/app/components/SelectionToolbar";
import { AISidebar } from "@/app/components/ai/AISidebar";
import { ConceptHud } from "@/app/components/ConceptHud";

// Hooks
import { useReadingLogic } from "./hooks/useReadingLogic";
import { useConceptStore, ConceptData } from "@/lib/store/useConceptStore";

// Dynamic Imports removed as we are unifying to ReaderView
// const EpubReader = dynamic(() => import("./EpubReader").then(m => m.EpubReader), { ssr: false });
// const PdfReader = dynamic(() => import("./PdfReader").then(m => m.PdfReader), { ssr: false });

interface ReaderClientProps {
  initialArticle?: Article;
  initialCollection?: Collection;
}

export default function ReaderClient({ initialArticle, initialCollection }: ReaderClientProps) {
  const searchParams = useSearchParams();
  
  // State for AI Sidebar
  const [isAiSidebarOpen, setIsAiSidebarOpen] = useState(false);
  const [aiInitialMessage, setAiInitialMessage] = useState<string | undefined>(undefined);
  const [aiSelection, setAiSelection] = useState<string | undefined>(undefined);

  const handleAiToggle = () => setIsAiSidebarOpen(!isAiSidebarOpen);
  
  const handleAskAi = (text: string) => {
      setAiSelection(text);
      setAiInitialMessage(`解释这段内容：\n\n${text}`);
      setIsAiSidebarOpen(true);
  };

  // UNIFICATION: We no longer check for localBook format (EPUB/PDF).
  // Everything is rendered via ReaderView using the 'article' data.
  // If localId is present, the logic below should eventually handle fetching the article data 
  // (Note: Currently useReadingLogic fetches remote article. We might need to ensure local articles are supported if offline)
  // For now, we assume the upload flow syncs Article data to DB/Cache so useReadingLogic works.

  // Remote Article Logic
  const {
    article,
    sentences,
    currentIndex,
    setCurrentIndex,
    isFinished,
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
    if (!sentences || sentences.length === 0) return undefined;
    const start = Math.max(0, currentIndex - 2);
    const end = Math.min(sentences.length, currentIndex + 8);
    return sentences
      .slice(start, end)
      .map((s: any) => (typeof s === 'string' ? s : String(s?.text ?? '')))
      .filter((s: string) => s.trim().length > 0)
      .join(' ');
  }, [sentences, currentIndex]);

  const router = useRouter();
  
  // Concept Logic
  const { concepts, addConcept, loadConcepts } = useConceptStore();
  
  // Ensure concepts are loaded on mount
  useEffect(() => { 
    loadConcepts(); 
  }, []); 

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
              <div className="fixed top-3 right-6 z-50 flex items-center gap-3">
                <motion.button
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => setIsTocOpen((v) => !v)}
                    className="pointer-events-auto flex items-center gap-2 bg-white/80 dark:bg-black/80 backdrop-blur-md px-3 py-2 rounded-full border border-zinc-200/50 dark:border-zinc-800/50 transition-colors hover:bg-white dark:hover:bg-zinc-950"
                    type="button"
                  >
                    <List className="w-3 h-3 text-zinc-400" />
                    <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
                      章节
                    </span>
                  </motion.button>
                  
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
                        {tocItems.map((item, i) => (
                          <button
                            key={`${item.index}-${i}`}
                            onClick={() => {
                              setCurrentIndex(item.index);
                              setIsTocOpen(false);
                            }}
                            className={twMerge(
                              "w-full text-left rounded-lg px-2 py-2 transition-colors text-xs",
                              item.index <= currentIndex && (tocItems[i+1]?.index > currentIndex || i === tocItems.length-1)
                                ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-900/60 dark:text-zinc-50"
                                : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900/30"
                            )}
                            style={{ paddingLeft: 8 + Math.max(0, item.depth - 1) * 12 }}
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
                className="fixed inset-0 z-[100] flex items-center justify-center bg-white/80 dark:bg-black/80 backdrop-blur-xl"
              >
                <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl shadow-2xl border border-zinc-100 dark:border-zinc-800 max-w-sm w-full text-center">
                    <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Check className="w-8 h-8 text-zinc-900 dark:text-zinc-100" />
                    </div>
                    <h2 className="text-2xl font-serif font-medium mb-2">阅读完成</h2>
                    <p className="text-zinc-500 dark:text-zinc-400 mb-8">
                        你已经完成了这次深度阅读。
                    </p>
                      <div className="space-y-3">
                      {nextArticleId && (
                          <button
                            onClick={() => router.replace(`/read?id=${nextArticleId}`)}
                            className="w-full py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black rounded-xl font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                          >
                            下一章 <ChevronRight className="w-4 h-4" />
                          </button>
                      )}
                      <button onClick={() => router.replace("/")} className="w-full py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
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
