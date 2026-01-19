'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { LocalBook, db } from '@/lib/db';
import { useTheme } from 'next-themes';
import { Loader2, List, X, ArrowLeft, Minus, Plus, Sparkles, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useConceptStore, ConceptData } from '@/lib/store/useConceptStore';
import { ConceptHud } from '@/app/components/ConceptHud';
import { ConceptCard } from '@/app/components/ConceptCard';
import { SelectionToolbar } from '@/app/components/SelectionToolbar';
import { twMerge } from 'tailwind-merge';
import { EpubParser, EpubBook, EpubChapter } from '@/lib/epub/epub-parser';

interface EpubReaderProps {
  book: LocalBook;
}

export function EpubReader({ book }: EpubReaderProps) {
  const [parsedBook, setParsedBook] = useState<EpubBook | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState(100);
  const [isTocOpen, setIsTocOpen] = useState(false);
  const router = useRouter();
  
  // Concept Store
  const { concepts, addConcept } = useConceptStore();
  const [activeCard, setActiveCard] = useState<{ x: number; y: number; term: string; savedData?: ConceptData } | null>(null);

  // Parse Book
  useEffect(() => {
    async function loadBook() {
      try {
        setLoading(true);
        const parser = new EpubParser();
        const data = await parser.parse(book.fileData);
        setParsedBook(data);
      } catch (e) {
        console.error("Failed to parse EPUB", e);
        setError("无法解析此文件");
      } finally {
        setLoading(false);
      }
    }
    loadBook();
  }, [book.fileData]);

  // Handle Selection
  const handleSelectionActivate = (text: string, rect: DOMRect) => {
    const saved = concepts[text];
    setActiveCard({
        x: rect.left,
        y: rect.top,
        term: text,
        savedData: saved
    });
  };

  const handleSaveCard = async (data: ConceptData) => {
      try {
          await addConcept({
              ...data,
              sourceArticleId: book.id 
          });
          setActiveCard(null);
      } catch (error) {
          console.error('Failed to save concept:', error);
      }
  };

  const visibleCards = useMemo(() => {
      return Object.values(concepts); 
  }, [concepts]);

  // Scroll to chapter
  const scrollToChapter = (id: string) => {
    const el = document.getElementById(`chapter-${id}`);
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setIsTocOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#FAFAFA] dark:bg-black">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
        <span className="ml-2 text-zinc-500 text-sm">解析文件中...</span>
      </div>
    );
  }

  if (error || !parsedBook) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-[#FAFAFA] dark:bg-black gap-4">
        <p className="text-zinc-500">{error || "加载失败"}</p>
        <button onClick={() => router.back()} className="text-zinc-900 underline">返回</button>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-[#FAFAFA] dark:bg-black relative overflow-hidden flex flex-col selection:bg-zinc-200 selection:text-black dark:selection:bg-zinc-800 dark:selection:text-white">
       
       {/* Noise Texture */}
       <div className="absolute inset-0 opacity-[0.015] pointer-events-none z-0 mix-blend-multiply dark:mix-blend-overlay"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
       />

       {/* Floating Header */}
       <header className="fixed top-0 left-0 right-0 h-[60px] flex items-center justify-between px-6 z-40 pointer-events-none">
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="pointer-events-auto flex items-center gap-2"
          >
             <button 
               onClick={() => router.push('/')}
               className="flex items-center gap-2 bg-white/80 dark:bg-black/80 backdrop-blur-md px-3 py-2 rounded-full border border-zinc-200/50 dark:border-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors text-zinc-600 dark:text-zinc-400"
             >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-xs font-medium max-w-[150px] truncate">{parsedBook.metadata.title || book.title}</span>
             </button>
          </motion.div>

          <div className="flex items-center gap-2 pointer-events-auto">
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

             <div className="flex items-center gap-1 bg-white/80 dark:bg-black/80 backdrop-blur-md px-2 py-1.5 rounded-full border border-zinc-200/50 dark:border-zinc-800/50">
                <button onClick={() => setFontSize(s => Math.max(80, s - 10))} className="p-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
                    <Minus className="w-3 h-3" />
                </button>
                <span className="text-[10px] font-mono w-8 text-center text-zinc-500">{fontSize}%</span>
                <button onClick={() => setFontSize(s => Math.min(200, s + 10))} className="p-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
                    <Plus className="w-3 h-3" />
                </button>
             </div>

             <button
               onClick={() => setIsTocOpen(!isTocOpen)}
               className={twMerge(
                 "flex items-center gap-2 bg-white/80 dark:bg-black/80 backdrop-blur-md px-3 py-2 rounded-full border border-zinc-200/50 dark:border-zinc-800/50 transition-colors",
                 isTocOpen ? "bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100" : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900"
               )}
             >
               <List className="w-4 h-4" />
             </button>
          </div>
       </header>

       {/* Native Scrollable Reader Area */}
       <main 
         className="flex-1 relative overflow-y-auto z-10 scroll-smooth no-scrollbar"
         style={{ fontSize: `${fontSize}%` }}
       >
         <div className="w-full max-w-3xl mx-auto px-6 py-[100px] flex flex-col gap-12">
            {parsedBook.chapters.map((chapter) => (
                <article 
                    key={chapter.id} 
                    id={`chapter-${chapter.id}`}
                    className="prose prose-zinc dark:prose-invert max-w-none prose-lg prose-p:leading-loose prose-p:text-justify prose-img:rounded-xl prose-headings:font-serif"
                >
                    <div dangerouslySetInnerHTML={{ __html: chapter.content }} />
                </article>
            ))}
         </div>
       </main>

       {/* Selection Toolbar (Global) */}
       <SelectionToolbar 
          onActivate={handleSelectionActivate}
          disabled={!!activeCard}
       />

       {/* Footer Hints */}
       <motion.footer 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 1 }}
        className="fixed bottom-8 left-0 right-0 flex justify-center z-40 pointer-events-none"
      >
        <div className="flex items-center gap-6 text-[10px] font-mono text-zinc-400 uppercase tracking-widest bg-white/50 dark:bg-black/50 backdrop-blur px-6 py-2 rounded-full border border-zinc-100 dark:border-zinc-900/50">
          <span className="flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-zinc-400" />
            Epub Native Reader
          </span>
        </div>
      </motion.footer>

       {/* TOC Sidebar */}
       <AnimatePresence>
         {isTocOpen && (
           <motion.div
             initial={{ x: '100%' }}
             animate={{ x: 0 }}
             exit={{ x: '100%' }}
             transition={{ type: 'spring', damping: 25, stiffness: 200 }}
             className="fixed top-0 right-0 h-full w-80 bg-white/95 dark:bg-black/95 backdrop-blur shadow-2xl border-l border-zinc-200 dark:border-zinc-800 z-50 flex flex-col"
           >
             <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800 h-[60px]">
               <h2 className="font-medium text-sm text-zinc-900 dark:text-zinc-100">Table of Contents</h2>
               <button onClick={() => setIsTocOpen(false)} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded text-zinc-500">
                 <X className="w-4 h-4" />
               </button>
             </div>
             <div className="flex-1 overflow-y-auto p-2 no-scrollbar">
               {parsedBook.chapters.map((chapter) => (
                 <button
                   key={chapter.id}
                   onClick={() => scrollToChapter(chapter.id)}
                   className="w-full text-left py-2.5 px-3 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-lg transition-colors truncate"
                 >
                   {chapter.title}
                 </button>
               ))}
             </div>
           </motion.div>
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
    </div>
  );
}
