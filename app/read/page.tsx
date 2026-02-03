"use client";
import { Suspense, useState, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { Loader2, List, Check, ChevronRight } from "lucide-react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { twMerge } from "tailwind-merge";

// Components
import { ReaderView } from "./components/ReaderView";
import { SimpleReaderHeader } from "./components/SimpleReaderHeader";
import { ReaderFooter } from "./components/ReaderFooter";
import { ChapterNavigator } from "@/app/components/book/ChapterNavigator";
import { ChapterListSidebar } from "@/app/components/book/ChapterListSidebar";
import { BookInfoBar } from "@/app/components/book/BookInfoBar";
import { ConceptCard } from "@/app/components/ConceptCard";
import { SelectionToolbar } from "@/app/components/SelectionToolbar";
import { RelatedConcepts } from "../components/RelatedConcepts";
import { ConceptHud } from "@/app/components/ConceptHud";

// Hooks
import { useReadingLogic } from "./hooks/useReadingLogic";
import { useConceptStore, ConceptData } from "@/lib/store/useConceptStore";

// Dynamic Imports
const EpubReader = dynamic(() => import("./EpubReader").then(m => m.EpubReader), { ssr: false });
const PdfReader = dynamic(() => import("./PdfReader").then(m => m.PdfReader), { ssr: false });

function ReadContent() {
  const searchParams = useSearchParams();
  const localId = searchParams.get("localId");

  // Local Book Handling
  const localBook = useLiveQuery(
    () => (localId ? db.books.get(localId) : undefined),
    [localId]
  );

  if (localId) {
    if (!localBook) {
      return (
        <div className="h-screen w-full flex items-center justify-center bg-zinc-50 dark:bg-black">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
        </div>
      );
    }
    return localBook.format === 'epub' ? <EpubReader book={localBook} /> : <PdfReader book={localBook} />;
  }

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
  } = useReadingLogic();

  const router = useRouter();
  
  // Concept Logic
  const { concepts, addConcept, loadConcepts } = useConceptStore();
  
  // Ensure concepts are loaded on mount
  useEffect(() => { 
    loadConcepts(); 
  }, []); // Remove dependency on loadConcepts to prevent loop if it's not stable

  const visibleCards = useMemo(() => {
    if (!article || !article.content) return [];
    // Convert to array and filter
    const allConcepts = Object.values(concepts);
    return allConcepts.filter(c => article.content!.includes(c.term));
  }, [article, concepts]); // Depend on concepts state

  const [activeCard, setActiveCard] = useState<{ x: number; y: number; term: string; savedData?: ConceptData } | null>(null);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [isTocOpen, setIsTocOpen] = useState(false);

  const handleTermClick = (e: React.MouseEvent, term: string) => {
      const saved = concepts[term];
      if (saved) {
        const rect = (e.target as HTMLElement).getBoundingClientRect();
        setActiveCard({ x: rect.left, y: rect.top, term, savedData: saved });
      }
  };

  const handleSaveCard = async (data: ConceptData) => {
      if (!article) return;
      try {
          // Optimistically update or wait for store
          await addConcept({ ...data, sourceArticleId: article.id });
          
          // Force re-fetch or ensure store updates
          // await loadConcepts(); 
          
          setActiveCard(null);
      } catch (error) {
          console.error('Failed to save concept:', error);
      }
  };

  if (isLoadingArticle) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-zinc-50 dark:bg-black">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!article) return null;

  const progress = sentences.length > 0 ? ((currentIndex + 1) / sentences.length) * 100 : 0;

  return (
    <div className="h-screen w-full bg-[#FAFAFA] dark:bg-black text-zinc-900 dark:text-zinc-50 font-sans overflow-hidden flex flex-col selection:bg-zinc-900 selection:text-white dark:selection:bg-white dark:selection:text-black relative">
       {/* Noise Texture */}
       <div className="absolute inset-0 opacity-[0.015] pointer-events-none z-0 mix-blend-multiply dark:mix-blend-overlay"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
      />

      {collection ? (
        <>
          <BookInfoBar
            collection={collection as any}
            article={{ id: article.id, title: article.title, progress }}
            currentChapter={article.order || 1}
            totalChapters={collection.totalChapters || 1}
            bookProgress={collection.readingProgress || 0}
          />
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
            title={article.title}
            progress={progress}
            tocAvailable={tocItems.length > 0}
            onTocToggle={() => setIsTocOpen(!isTocOpen)}
            visibleCards={visibleCards}
            onTermClick={(term) => {
                 const saved = concepts[term];
                 if(saved) setActiveCard({ x: window.innerWidth/2 - 140, y: window.innerHeight/2 - 100, term, savedData: saved });
            }}
        />
      )}

      <ReaderView
        sentences={sentences}
        currentIndex={currentIndex}
        articleType={article.type}
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
          collection && tocMode === 'chapters' ? (
            <ChapterListSidebar
              collection={collection as any}
              currentArticleId={article.id}
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
      />
      
      <RelatedConcepts 
        currentText={sentences[currentIndex] || ""}
        onConceptClick={(term) => {
             const saved = concepts[term];
             if(saved) setActiveCard({ x: window.innerWidth/2 - 140, y: window.innerHeight/2 - 100, term, savedData: saved });
        }}
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
  );
}

export default function ReadPage() {
  return (
    <Suspense fallback={<div className="h-screen w-full flex items-center justify-center bg-[#FAFAFA] dark:bg-[#050505]"><Loader2 className="w-6 h-6 animate-spin" /></div>}>
      <ReadContent />
    </Suspense>
  );
}
