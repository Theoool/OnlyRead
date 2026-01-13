"use client";
import { useEffect, useState, useRef, Suspense, Children, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import * as articlesAPI from "@/lib/api/articles";
import type { Article, ConceptCardData } from "@/lib/articles-legacy";
import { splitMarkdownBlocks, splitSentences } from "@/lib/text-processing";
import { recordSession } from "@/lib/stats";
import { motion, AnimatePresence } from "framer-motion";
import { twMerge } from "tailwind-merge";
import { Check, Lock, X, ArrowLeft, ChevronRight, BookOpen, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import "highlight.js/styles/github-dark.css";
import { ConceptCard } from "@/app/components/ConceptCard";
import { SelectionToolbar } from "@/app/components/SelectionToolbar";
import { ConceptHud } from "@/app/components/ConceptHud";
import { useConceptStore, ConceptData } from "@/lib/store/useConceptStore";

function MarkdownImage({ src, alt }: { src?: string; alt?: string }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  return (
    <div
      className="relative w-full my-4 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900"
      style={{ aspectRatio: "16 / 9", minHeight: 180 }}
    >
      {!loaded && !error && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900" />
      )}
      {!error && src ? (
        <img
          key={retryKey}
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
          className="absolute inset-0 w-full h-full object-contain"
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
        />
      ) : null}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
          <span>图片加载失败</span>
          <button
            onClick={() => {
              setError(false);
              setLoaded(false);
              setRetryKey((k) => k + 1);
            }}
            className="px-2 py-1 rounded bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black"
          >
            重试
          </button>
          {src && (
            <a
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700"
            >
              在新标签打开
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function HighlightText({ text, cards, onTermClick }: { text: string, cards: ConceptData[], onTermClick: (e: React.MouseEvent, term: string) => void }) {
  if (!cards?.length) return <>{text}</>;
  
  const terms = cards.map(c => c.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`(${terms.join('|')})`, 'g');
  const parts = text.split(pattern);
  
  return (
    <>
      {parts.map((part, i) => {
        const isMatch = cards.some(c => c.term === part);
        if (isMatch) {
          return (
            <span 
              key={i}
              onClick={(e) => {
                  e.stopPropagation();
                  onTermClick(e, part);
              }}
              className="border-b-[1.5px] border-purple-400/50 bg-purple-100/50 dark:bg-purple-900/30 cursor-pointer hover:bg-purple-200 dark:hover:bg-purple-800/50 transition-colors rounded-sm px-0.5"
            >
              {part}
            </span>
          );
        }
        return part;
      })}
    </>
  );
}

function ReadContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get("id");
  const [article, setArticle] = useState<Article | null>(null);
  const [sentences, setSentences] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Global Store
  const { concepts, addConcept } = useConceptStore();
  
  // Compute visible concepts for this article
  const visibleCards = useMemo(() => {
      if (!article || !article.content) return [];
      const all = Object.values(concepts);
      // Simple inclusion check - can be optimized later
      return all.filter(c => article.content!.includes(c.term));
  }, [article, concepts]);
  
  // Concept Card State
  const [activeCard, setActiveCard] = useState<{ x: number; y: number; term: string; savedData?: ConceptData } | null>(null);

  const handleToolbarActivate = (text: string, rect: DOMRect) => {
      // Check if already collected (Global check)
      const saved = concepts[text];
      if (saved) {
           setActiveCard({ 
              x: rect.left, 
              y: rect.top, 
              term: text,
              savedData: saved
          });
          return;
      }

      // Check limit (Per article context? Or global daily limit? Let's keep per-article limit logic for now based on visibleCards)
      if (visibleCards.length >= 5) {
          // Optional: Show a toast or small alert
          // For now, we allow more since it's global, but maybe warn?
          // Adhering to "Small & Beautiful", maybe we don't block strictly if it's global, 
          // OR we block if *newly created* for this article exceeds 5.
          // Let's relax it slightly for global store transition or keep strict.
          // User instruction: "每篇文章最多5次".
          // We count how many cards have sourceArticleId === currentId
          const currentArticleCount = Object.values(concepts).filter(c => c.sourceArticleId === article?.id).length;
          if (currentArticleCount >= 5) return;
      }
      
      // Set card position
      setActiveCard({ 
          x: rect.left, 
          y: rect.top, 
          term: text 
      });
  };

  const handleTermClick = (e: React.MouseEvent, term: string) => {
      const saved = concepts[term];
      if (saved) {
        const rect = (e.target as HTMLElement).getBoundingClientRect();
        setActiveCard({
            x: rect.left,
            y: rect.top,
            term,
            savedData: saved
        });
      }
  };

  const handleSaveCard = async (data: ConceptData) => {
      if (!article) return;

      try {
          await addConcept({
              ...data,
              sourceArticleId: article.id
          });
          setActiveCard(null);
      } catch (error) {
          console.error('Failed to save concept:', error);
      }
  };

  const lastNextTime = useRef<number>(0);
  const sessionStartTime = useRef<number>(Date.now());
  const [isCooldown, setIsCooldown] = useState(false);
  const [shake, setShake] = useState(0);
  const [loadingArticle, setLoadingArticle] = useState(true);
  const [cooldownProgress, setCooldownProgress] = useState(100);

  // Scroll ref
  const currentSentenceRef = useRef<HTMLParagraphElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadArticle = async () => {
      if (!id) {
        router.replace("/");
        return;
      }

      setLoadingArticle(true);

      try {
        const found = await articlesAPI.getArticle(id);
        if (!found) {
          router.replace("/");
          return;
        }

        setArticle(found);
        const s = found.type === 'markdown'
          ? splitMarkdownBlocks(found.content || "")
          : splitSentences(found.content || "");
        setSentences(s);

        // Restore progress
        if (found.lastReadSentence && found.lastReadSentence < s.length) {
          setCurrentIndex(found.lastReadSentence);
        } else {
          setCurrentIndex(0);
        }
      } catch (error) {
        console.error('Failed to load article:', error);
        router.replace("/");
      } finally {
        setLoadingArticle(false);
      }
    };

    loadArticle();
  }, [id, router]);

  // Auto scroll to center
  useEffect(() => {
    if (currentSentenceRef.current) {
      const el = currentSentenceRef.current;
      
      // Smart Scroll:
      // If the element is taller than 50% of the viewport, align to top (start).
      // Otherwise, align to center.
      const rect = el.getBoundingClientRect();
      const isLargeBlock = rect.height > window.innerHeight * 0.5;
      
      requestAnimationFrame(() => {
        el.scrollIntoView({
          behavior: "smooth",
          block: isLargeBlock ? "start" : "center",
        });
      });
    }
    
    // Update progress
    if (article && sentences.length > 0) {
      const progress = ((currentIndex + 1) / sentences.length) * 100;
      articlesAPI.updateArticle(article.id, {
        progress,
        lastReadSentence: currentIndex,
        lastRead: Date.now(),
      }).catch(err => console.error('Failed to update article progress:', err));
    }
    
    // Reset cooldown animation on new sentence
    setCooldownProgress(0);
    setIsCooldown(true);
    const currentSentence = sentences[currentIndex] || "";
    
    // Smart Read Time:
    // Base: 200ms
    // Text: 20ms per char
    // Markdown/Code: Cap at 3000ms to avoid frustration on long blocks
    let minReadTime = 200 + (currentSentence.length * 20);
    if (article?.type === 'markdown') {
        // Cap at 3s for Markdown blocks to ensure flow isn't broken for huge code blocks
        minReadTime = Math.min(minReadTime, 3000); 
    }
    
    // Animate cooldown bar
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const p = Math.min(100, (elapsed / minReadTime) * 100);
      setCooldownProgress(p);
      if (p >= 100) {
        setIsCooldown(false);
        clearInterval(interval);
      }
    }, 16);
    
    return () => clearInterval(interval);
  }, [currentIndex, article, sentences.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Block restricted keys
      const restricted = [
        "ArrowUp", "ArrowDown", "ArrowRight",
        "PageUp", "PageDown", "Home", "End",
        "w", "s", "d", "W", "S", "D"
      ];
      
      if (restricted.includes(e.key)) {
        e.preventDefault();
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        if (article) {
          recordSession({
            articleId: article.id,
            startTime: sessionStartTime.current,
            endTime: Date.now(),
            duration: Date.now() - sessionStartTime.current
          });
        }
        router.replace("/");
        return;
      }

      // Backtracking
      if (e.key === "ArrowLeft" || e.key === "Backspace" || e.key === "a" || e.key === "A") {
        e.preventDefault();
        if (currentIndex > 0) {
          setCurrentIndex((prev) => prev - 1);
        }
        return;
      }

      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        
        // Dynamic Debounce based on sentence length
        const currentSentence = sentences[currentIndex] || "";
        let minReadTime = 200 + (currentSentence.length * 20);
        if (article?.type === 'markdown') {
            minReadTime = Math.min(minReadTime, 3000);
        }

        const now = Date.now();
        const timeSinceLast = now - lastNextTime.current;

        if (timeSinceLast < minReadTime) {
          // Too fast - shake effect
          setShake(prev => prev + 1);
          return;
        }

        if (currentIndex < sentences.length - 1) {
          lastNextTime.current = now;
          setCurrentIndex((prev) => prev + 1);
        } else {
          // Finished
          // We'll show a completion modal instead of alert
          if (article && !isFinished) {
            recordSession({
              articleId: article.id,
              startTime: sessionStartTime.current,
              endTime: Date.now(),
              duration: Date.now() - sessionStartTime.current
            });
          }
          setIsFinished(true);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, { passive: false });
    
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [currentIndex, sentences.length, router]);

  const [isFinished, setIsFinished] = useState(false);

  const highlightMarkdown = (children: React.ReactNode) => {
    if (!visibleCards.length) return children;
    
    return Children.map(children, child => {
        if (typeof child === 'string') {
            return (
                <HighlightText 
                    text={child} 
                    cards={visibleCards} 
                    onTermClick={handleTermClick} 
                />
            );
        }
        return child;
    });
  };

  if (loadingArticle) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-zinc-400" />
          <p className="text-zinc-500 dark:text-zinc-400">Loading article...</p>
        </div>
      </div>
    );
  }

  if (!article) return null;

  const progress = sentences.length > 0 
    ? ((currentIndex + 1) / sentences.length) * 100 
    : 0;

  return (
    <div className="h-screen w-full bg-[#FAFAFA] dark:bg-black text-zinc-900 dark:text-zinc-50 font-sans overflow-hidden flex flex-col selection:bg-zinc-900 selection:text-white dark:selection:bg-white dark:selection:text-black relative">
      
      {/* Subtle Noise Texture */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none z-0 mix-blend-multiply dark:mix-blend-overlay"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
      />

      {/* Floating Header */}
      <header className="fixed top-0 left-0 right-0 h-[60px] flex items-center justify-between px-6 md:px-12 z-50 pointer-events-none">
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 bg-white/80 dark:bg-black/80 backdrop-blur-md px-4 py-2 rounded-full shadow-sm border border-zinc-200/50 dark:border-zinc-800/50"
        >
          <BookOpen className="w-3 h-3 text-zinc-400" />
          <h1 className="text-xs font-medium truncate max-w-[200px] opacity-80">
            {article.title}
          </h1>
        </motion.div>
        
        <div className="flex items-center gap-3">
            {/* Concept HUD */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
            >
                <ConceptHud 
                    cards={visibleCards} 
                    onTermClick={(term) => {
                        const saved = concepts[term];
                        if (saved) {
                             // Center of screen roughly
                            setActiveCard({
                                x: window.innerWidth / 2 - 140, // 280px width / 2
                                y: window.innerHeight / 2 - 100,
                                term,
                                savedData: saved
                            });
                        }
                    }}
                />
            </motion.div>

            <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 bg-white/80 dark:bg-black/80 backdrop-blur-md px-3 py-2 rounded-full border border-zinc-200/50 dark:border-zinc-800/50"
            >
            <span className="text-[10px] font-mono text-zinc-400">
                {Math.round(progress)}%
            </span>
            <div className="w-12 h-1 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <motion.div
                className="h-full bg-zinc-900 dark:bg-zinc-100"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: "circOut" }}
                />
            </div>
            </motion.div>
        </div>
      </header>

      {/* Reading Area */}
      <main 
        ref={containerRef}
        className="flex-1 relative overflow-y-auto flex flex-col items-center z-10 scroll-smooth no-scrollbar"
      >
        <div className="w-full max-w-2xl px-8 py-[40vh] flex flex-col gap-10">
          {sentences.map((sentence, index) => {
            const isVisible = index <= currentIndex;
            const isCurrent = index === currentIndex;
            const isPast = index < currentIndex;
            
            if (!isVisible) return null;

            return (
              <motion.div
                key={index}
                ref={isCurrent ? currentSentenceRef : null}
                initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
                animate={{ 
                  opacity: isCurrent ? 1 : 0.2, 
                  y: 0, 
                  filter: isCurrent ? "blur(0px)" : "blur(1px)", // Reduced blur for performance
                  scale: isCurrent ? 1.05 : 1, // Reduced scale range
                  x: isCurrent && shake % 2 !== 0 ? [0, -4, 4, -4, 4, 0] : 0
                }}
                transition={{ 
                  duration: 0.4,
                  ease: "easeOut"
                }}
                className={twMerge(
                  "relative group transition-all duration-500 ease-out my-8 scroll-mt-24", // Added scroll-mt-24
                  "will-change-transform", // Hint for browser
                  article.type === 'markdown' ? "w-full" : ""
                )}
              >
                 {article.type === 'markdown' ? (
                  <div className={twMerge(
                    "text-lg md:text-xl leading-relaxed text-zinc-800 dark:text-zinc-200 transition-colors duration-300",
                    isCurrent ? "opacity-100" : "opacity-50" // Removed blur for better readability
                  )}>
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeHighlight]}
                      components={{
                        h1: ({children}) => <h1 className="text-3xl font-bold mt-8 mb-4 text-zinc-900 dark:text-zinc-50">{highlightMarkdown(children)}</h1>,
                        h2: ({children}) => <h2 className="text-2xl font-bold mt-6 mb-3 text-zinc-900 dark:text-zinc-50">{highlightMarkdown(children)}</h2>,
                        h3: ({children}) => <h3 className="text-xl font-bold mt-4 mb-2 text-zinc-900 dark:text-zinc-50">{highlightMarkdown(children)}</h3>,
                        p: ({children}) => <p className="mb-4 leading-relaxed">{highlightMarkdown(children)}</p>,
                        ul: ({children}) => <ul className="list-disc list-inside mb-4 pl-4 space-y-1">{children}</ul>,
                        ol: ({children}) => <ol className="list-decimal list-inside mb-4 pl-4 space-y-1">{children}</ol>,
                        li: ({children}) => <li className="mb-1">{highlightMarkdown(children)}</li>,
                        blockquote: ({children}) => <blockquote className="border-l-4 border-zinc-300 dark:border-zinc-700 pl-4 italic my-4 text-zinc-500 dark:text-zinc-400">{highlightMarkdown(children)}</blockquote>,
                        pre: ({children}) => <div className="my-6 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-sm"><pre className="bg-[#0d1117] p-4 overflow-x-auto text-sm font-mono text-zinc-100">{children}</pre></div>,
                        code: ({node, className, children, ...props}: any) => {
                          const match = /language-(\w+)/.exec(className || '');
                          const isInline = !match && !className?.includes('hljs');
                          return isInline ? (
                            <code className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-sm font-mono text-zinc-800 dark:text-zinc-200" {...props}>
                              {children}
                            </code>
                          ) : (
                            <code className={className} {...props}>
                              {children}
                            </code>
                          );
                        },
                        a: ({href, children}) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline decoration-blue-500/30">{children}</a>,
                        img: ({ src, alt }) => <MarkdownImage src={src as string} alt={alt as string} />,
                        table: ({children}) => <div className="overflow-x-auto my-6 border border-zinc-200 dark:border-zinc-800 rounded-lg"><table className="min-w-full text-left text-sm">{children}</table></div>,
                        thead: ({children}) => <thead className="bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 font-medium">{children}</thead>,
                        tbody: ({children}) => <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">{children}</tbody>,
                        tr: ({children}) => <tr className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">{children}</tr>,
                        th: ({children}) => <th className="p-3 text-zinc-900 dark:text-zinc-100">{children}</th>,
                        td: ({children}) => <td className="p-3 text-zinc-600 dark:text-zinc-400">{children}</td>,
                      }}
                    >
                      {sentence}
                    </ReactMarkdown>
                  </div>
                ) : (
                 <p className={twMerge(
                   "text-xl md:text-3xl leading-relaxed font-serif tracking-wide transition-colors duration-300",
                   isCurrent ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-300 dark:text-zinc-700"
                 )}>
                   <HighlightText 
                      text={sentence} 
                      cards={visibleCards} 
                      onTermClick={handleTermClick} 
                   />
                 </p>
                 )}
                 
                 {/* Cooldown Indicator for Current Sentence */}
                 {isCurrent && (
                   <motion.div 
                     initial={{ opacity: 0 }}
                     animate={{ opacity: isCooldown ? 1 : 0 }}
                     className="absolute -left-4 top-1/2 -translate-y-1/2 w-1 h-full max-h-[1.5em] rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden"
                   >
                      <motion.div 
                        className="w-full bg-zinc-900 dark:bg-zinc-100 bottom-0 absolute"
                        style={{ height: `${cooldownProgress}%` }}
                      />
                   </motion.div>
                 )}
              </motion.div>
            );
          })}
        </div>
      </main>
      
      {/* Floating Footer Hint */}
      <motion.footer 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 1 }}
        className="fixed bottom-8 left-0 right-0 flex justify-center z-40 pointer-events-none"
      >
        <div className="flex items-center gap-6 text-[10px] font-mono text-zinc-400 uppercase tracking-widest bg-white/50 dark:bg-black/50 backdrop-blur px-6 py-2 rounded-full border border-zinc-100 dark:border-zinc-900/50">
          <span className="flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-zinc-400" />
            Space to Read
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-zinc-400" />
            Left to Back
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-zinc-400" />
            ESC to Exit
          </span>
        </div>
      </motion.footer>

      {/* Selection Toolbar */}
      <SelectionToolbar 
        onActivate={handleToolbarActivate} 
        disabled={!!activeCard} 
      />

      {/* Concept Card */}
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

      {/* Completion Modal */}
      <AnimatePresence>
        {isFinished && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-white/80 dark:bg-black/80 backdrop-blur-xl"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white dark:bg-zinc-900 p-8 rounded-2xl shadow-2xl border border-zinc-100 dark:border-zinc-800 max-w-sm w-full text-center"
            >
              <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-6">
                <Check className="w-8 h-8 text-zinc-900 dark:text-zinc-100" />
              </div>
              <h2 className="text-2xl font-serif font-medium mb-2">阅读完成</h2>
              <p className="text-zinc-500 dark:text-zinc-400 mb-8">
                你已经完成了这次深度阅读。
              </p>
              <button
                onClick={() => router.replace("/")}
                className="w-full py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black rounded-xl font-medium hover:opacity-90 transition-opacity"
              >
                返回首页
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ReadPage() {
  return (
    <Suspense fallback={<div className="h-screen w-full flex items-center justify-center bg-[#FAFAFA] dark:bg-[#050505]"><div className="w-6 h-6 border-2 border-zinc-900 dark:border-zinc-100 rounded-full animate-spin border-t-transparent"></div></div>}>
      <ReadContent />
    </Suspense>
  );
}
