'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { LocalBook } from '@/lib/db';
import { useTheme } from 'next-themes';
import { Loader2, List, X, ArrowLeft, Minus, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useConceptStore, ConceptData } from '@/lib/store/useConceptStore';
import { ConceptHud } from '@/app/components/ConceptHud';
import { ConceptCard } from '@/app/components/ConceptCard';
import { twMerge } from 'tailwind-merge';
import { EpubView } from 'react-reader';

interface EpubReaderProps {
  book: LocalBook;
}

export function EpubReader({ book }: EpubReaderProps) {
  const [location, setLocation] = useState<string | number>(0);
  const [toc, setToc] = useState<any[]>([]);
  const renditionRef = useRef<any>(null);
  const [isTocOpen, setIsTocOpen] = useState(false);
  const [fontSize, setFontSize] = useState(100);
  const router = useRouter();
  const { theme } = useTheme();
  
  // Concept Store
  const { concepts, addConcept } = useConceptStore();
  const [activeCard, setActiveCard] = useState<{ x: number; y: number; term: string; savedData?: ConceptData } | null>(null);

  // Clean up Blob URL (Safe for Strict Mode)
  // We don't revoke immediately on unmount because Strict Mode will unmount/remount quickly,
  // causing the URL to be invalid on the second mount.
  // We rely on the browser's GC or book change to clear.
  /*
  const url = useMemo(() => {
    if (!book.fileData) return null;
    return URL.createObjectURL(new Blob([book.fileData], { type: 'application/epub+zip' }));
  }, [book.fileData]);
  */

  // Styles Injection
  const updateTheme = useCallback((rendition: any) => {
    if (!rendition) return;
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
         'max-width': '800px !important',
         'margin': '0 auto !important',
       },
       'p': { 
         'font-size': '1.125rem !important',
         'line-height': '1.8 !important',
         'text-align': 'justify !important',
         'margin-bottom': '1.5em !important'
       },
       'h1': { 'font-family': 'serif', 'margin-top': '2em' },
       'h2': { 'font-family': 'serif', 'margin-top': '1.5em' },
       'img': { 'max-width': '100%', 'border-radius': '0.5rem' },
       '::selection': {
           'background': isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'
       }
    });
    rendition.themes.select('custom');
  }, [theme]);

  // Update theme when changed
  useEffect(() => {
      if (renditionRef.current) {
          updateTheme(renditionRef.current);
      }
  }, [theme, updateTheme]);

  // Update fontSize
  useEffect(() => {
      const rendition = renditionRef.current;
      if (rendition) {
          rendition.themes.fontSize(`${fontSize}%`);
      }
  }, [fontSize]);

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
          // Optional: Clear selection in epub
          // renditionRef.current?.getContents()[0]?.window.getSelection().removeAllRanges();
      } catch (error) {
          console.error('Failed to save concept:', error);
      }
  };

  const visibleCards = useMemo(() => {
      return Object.values(concepts); 
  }, [concepts]);

  if (!book.fileData) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#FAFAFA] dark:bg-black">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-[#FAFAFA] dark:bg-black relative overflow-hidden flex flex-col">
       {/* Background Noise */}
       <div className="absolute inset-0 opacity-[0.015] pointer-events-none z-0 mix-blend-multiply dark:mix-blend-overlay"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
       />

       {/* Header */}
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
                <span className="text-xs font-medium max-w-[150px] truncate">{book.title}</span>
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

       {/* Reader Area */}
       <div className="flex-1 w-full h-full relative z-10">
           <EpubView
              style={{ height: '100vh' }}
              url={book.fileData}
              location={location}
              locationChanged={(loc: string | number) => setLocation(loc)}
              tocChanged={(t) => setToc(t)}
              epubOptions={{
                  flow: 'scrolled',
                  manager: 'continuous',
                  width: '100%',
                  height: '100%',
              }}
              getRendition={(rendition) => {
                  renditionRef.current = rendition;
                  updateTheme(rendition);
                  
                  rendition.on('selected', (cfiRange: string, contents: any) => {
                      const range = contents.window.getSelection().getRangeAt(0);
                      const rect = range.getBoundingClientRect();
                      
                      // Calculate absolute position relative to viewport
                      const iframe = rendition.manager.container.querySelector('iframe');
                      let x = rect.left;
                      let y = rect.top;
                      
                      if (iframe) {
                          const iframeRect = iframe.getBoundingClientRect();
                          x += iframeRect.left;
                          y += iframeRect.top;
                      }

                      handleSelectionActivate(
                          range.toString(),
                          {
                              left: x,
                              top: y,
                              width: rect.width,
                              height: rect.height,
                              right: x + rect.width,
                              bottom: y + rect.height,
                              x, y, toJSON: () => {}
                          } as DOMRect
                      );
                  });
              }}
           />
       </div>
       
       {/* Footer */}
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
               {toc.map((chapter, i) => (
                 <button
                   key={i}
                   onClick={() => {
                       setLocation(chapter.href);
                       setIsTocOpen(false);
                   }}
                   className="w-full text-left py-2.5 px-3 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-lg transition-colors truncate"
                 >
                   {chapter.label}
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
