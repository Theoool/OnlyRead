"use client";
import { useEffect, useState, useRef, useMemo, Suspense, Children, memo } from "react";
import { useSearchParams, useRouter } from "next/navigation";

import { splitMarkdownBlocks, splitSentences } from "@/lib/text-processing";
import { StatsService } from "@/lib/core/reading/stats.service";
import { motion, AnimatePresence } from "framer-motion";
import { twMerge } from "tailwind-merge";
import { Check, BookOpen, Loader2, Image as ImageIcon, EyeOff, Eye, List, ChevronLeft, ChevronRight } from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import "highlight.js/styles/github-dark.css";
import { ConceptCard } from "@/app/components/ConceptCard";
import { SelectionToolbar } from "@/app/components/SelectionToolbar";
import { ConceptHud } from "@/app/components/ConceptHud";
import { useConceptStore, ConceptData } from "@/lib/store/useConceptStore";
import { useArticle, useUpdateArticleProgress, useArticleNavigation } from "@/lib/hooks";
import { getCollection, Collection } from "@/lib/core/reading/collections.service";
import { RelatedConcepts } from "../components/RelatedConcepts";
import { BookInfoBar } from "@/app/components/book/BookInfoBar";
import { ChapterNavigator } from "@/app/components/book/ChapterNavigator";
import { ChapterListSidebar } from "@/app/components/book/ChapterListSidebar";


function MarkdownImage({ src, alt }: { src?: string; alt?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="w-full my-4 p-4 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center gap-3 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800/80 transition-colors group"
      >
        <ImageIcon className="w-4 h-4" />
        <span className="text-xs font-mono">Image: {alt || "Hidden"}</span>
        <span className="text-xs text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors ml-auto flex items-center gap-1">
          <Eye className="w-3 h-3" /> Show
        </span>
      </button>
    );
  }

  return (
    <div className="relative group">
      <span
        className="block relative w-full my-4 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900"
        style={{ aspectRatio: "16 / 9", minHeight: 180 }}
      >
        {!loaded && !error && (
          <span className="block absolute inset-0 animate-pulse bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900" />
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
          <span className="absolute inset-0 flex items-center justify-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
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
          </span>
        )}
      </span>
      <button 
        onClick={() => setIsOpen(false)}
        className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
        title="Hide Image"
      >
        <EyeOff className="w-3 h-3" />
      </button>
    </div>
  );
}

const HighlightText = memo(function HighlightText({ text, cards, onTermClick }: { text: string, cards: ConceptData[], onTermClick: (e: React.MouseEvent, term: string) => void }) {
  if (!cards?.length) return <>{text}</>;
  
  // Memoize regex creation inside the component is not ideal if re-renders are frequent, 
  // but React.memo on the component helps.
  const terms = useMemo(() => cards.map(c => c.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), [cards]);
  const pattern = useMemo(() => new RegExp(`(${terms.join('|')})`, 'g'), [terms]);
  
  if (terms.length === 0) return <>{text}</>;

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
});

function ReadContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get("id");

  // React Query hooks - 自动加载和缓存文章
  const { data: article, isLoading: isLoadingArticle, error: articleError } = useArticle(id || '');
  const updateProgressMutation = useUpdateArticleProgress();

  const [sentences, setSentences] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Collection Navigation State
  const [nextArticleId, setNextArticleId] = useState<string | null>(null);
  const [prevArticleId, setPrevArticleId] = useState<string | null>(null);
  const [collection, setCollection] = useState<Collection | null>(null);
  const [tocMode, setTocMode] = useState<'chapters' | 'headings'>('headings');

  useEffect(() => {
    async function fetchNavigation() {
      if (article?.collectionId) {
        try {
          // Use the dedicated navigation API
          const res = await fetch(`/api/collections/${article.id}/navigation`);
          if (res.ok) {
            const data = await res.json();
            const nav = data.data.navigation;
            
            if (nav.collection) {
              setCollection(nav.collection);
              setTocMode('chapters');
            }
            
            if (nav.prev) setPrevArticleId(nav.prev.id);
            if (nav.next) setNextArticleId(nav.next.id);
          } else {
            // Fallback to old method if API fails
            const col = await getCollection(article.collectionId!);
            if (col) {
               setCollection(col);
               setTocMode('chapters');
               
               if (col.articles) {
                  const sorted = col.articles.sort((a, b) => (a.order || 0) - (b.order || 0));
                  const idx = sorted.findIndex(a => a.id === article.id);
                  if (idx >= 0) {
                    if (idx > 0) setPrevArticleId(sorted[idx - 1].id);
                    if (idx < sorted.length - 1) setNextArticleId(sorted[idx + 1].id);
                  }
               }
            }
          }
        } catch (e) {
          console.error("Failed to fetch collection nav", e);
        }
      }
    }
    fetchNavigation();
  }, [article?.collectionId, article?.id]);

  const { concepts, addConcept } = useConceptStore();

  const currentSentenceText = sentences[currentIndex] || "";
  
  const visibleCards = useMemo(() => {
      if (!article || !article.content) return [];
      const all = Object.values(concepts);
     
      return all.filter(c => article.content!.includes(c.term));
  }, [article, concepts]);


  const [activeCard, setActiveCard] = useState<{ x: number; y: number; term: string; savedData?: ConceptData } | null>(null);

  const handleToolbarActivate = (text: string, rect: DOMRect) => {
    
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

    
      if (visibleCards.length >= 5) {
         
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
  const [cooldownProgress, setCooldownProgress] = useState(100);

  // Scroll ref
  const currentSentenceRef = useRef<HTMLParagraphElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 错误处理 - 文章不存在或加载失败
  useEffect(() => {
    if (articleError && !isLoadingArticle) {
      console.error('Failed to load article:', articleError);
      router.replace("/");
    }
  }, [articleError, isLoadingArticle, router]);

  // 文章加载后初始化句子和进度
  useEffect(() => {
    if (article) {
      const s = article.type === 'markdown'
        ? splitMarkdownBlocks(article.content || "")
        : splitSentences(article.content || "");
      setSentences(s);

      // Restore progress
      if (article.lastReadSentence && article.lastReadSentence < s.length) {
        setCurrentIndex(article.lastReadSentence);
      } else {
        setCurrentIndex(0);
      }
    }
  }, [article]);

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
    // Moved to separate useEffect with debounce
    
    // Reset cooldown animation on new sentence
    setCooldownProgress(0);
    setIsCooldown(true);
    const currentSentence = sentences[currentIndex] || "";
    
    // Smart Read Time:
    // Base: 200ms
    // Text: char 20ms per
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

  // Debounced progress saving with unmount handling
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const saveProgress = () => {
    if (!article) return;
    const progress = ((currentIndex + 1) / sentences.length) * 100;
    updateProgressMutation.mutate({
      id: article.id,
      progress,
      lastReadSentence: currentIndex,
      lastRead: Date.now(),
      skipInvalidation: true
    });
  };

  useEffect(() => {
    if (!article || sentences.length === 0) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(saveProgress, 2000);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        // Save immediately on unmount/change
        saveProgress(); 
      }
    };
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

      if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        setIsTocOpen((v) => !v);
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        if (article) {
          // Force save progress
          const progress = ((currentIndex + 1) / sentences.length) * 100;
          updateProgressMutation.mutate({
            id: article.id,
            progress,
            lastReadSentence: currentIndex,
            lastRead: Date.now(),
          });

          // recordSession({
          //   articleId: article.id,
          //   startTime: sessionStartTime.current,
          //   endTime: Date.now(),
          //   duration: Date.now() - sessionStartTime.current
          // });
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
            // Force save progress
            updateProgressMutation.mutate({
              id: article.id,
              progress: 100,
              lastReadSentence: currentIndex,
              lastRead: Date.now(),
            });

            /*
            recordSession({
              articleId: article.id,
              startTime: sessionStartTime.current,
              endTime: Date.now(),
              duration: Date.now() - sessionStartTime.current
            });
            */
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
  const [isTocOpen, setIsTocOpen] = useState(false);

  const tocItems = useMemo(() => {
    if (article?.type !== "markdown") return [];

    const items: { index: number; depth: number; text: string }[] = [];

    for (let i = 0; i < sentences.length; i++) {
      const block = sentences[i] || "";
      const lines = block.split("\n");
      let inCodeFence = false;

      for (const rawLine of lines) {
        const line = rawLine.trimEnd();
        if (line.trimStart().startsWith("```")) {
          inCodeFence = !inCodeFence;
          continue;
        }
        if (inCodeFence) continue;

        const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
        if (!match) continue;
        const depth = match[1]?.length || 1;
        const text = match[2]?.trim() || "";
        if (!text) continue;
        items.push({ index: i, depth, text });
      }
    }

    return items;
  }, [article?.type, sentences]);

  const activeTocIndex = useMemo(() => {
    if (!tocItems.length) return -1;
    for (let i = tocItems.length - 1; i >= 0; i--) {
      if (tocItems[i].index <= currentIndex) return i;
    }
    return 0;
  }, [currentIndex, tocItems]);

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

  // --- Optimization: Windowed Rendering ---
  // Only render sentences around the current index to keep DOM light
  const RENDER_WINDOW = 50; // Keep 50 items in DOM (past + future)
  const renderStartIndex = Math.max(0, currentIndex - 40);
  const renderEndIndex = Math.min(sentences.length, currentIndex + 10);

  if (isLoadingArticle) {
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
      
      {/* Subtle Noise Texture - Reduced Opacity for cleaner look */}
      <div className="absolute inset-0 opacity-[0.015] pointer-events-none z-0 mix-blend-multiply dark:mix-blend-overlay"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
      />

      {/* Conditional Header: BookInfoBar or Default Header */}
      {collection ? (
        <BookInfoBar
          collection={{
            id: collection.id,
            title: collection.title,
            author: collection.author,
            totalChapters: collection.totalChapters,
            completedChapters: collection.completedChapters,
            readingProgress: collection.readingProgress,
          }}
          article={{
            id: article.id,
            title: article.title,
            progress: progress,
          }}
          currentChapter={article.order || 1}
          totalChapters={collection.totalChapters || 1}
          bookProgress={collection.readingProgress || 0}
        />
      ) : (
        /* Floating Header (Default) */
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
              <motion.button
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                onClick={() => {
                  if (tocItems.length) setIsTocOpen((v) => !v);
                }}
                className={twMerge(
                  "pointer-events-auto flex items-center gap-2 bg-white/80 dark:bg-black/80 backdrop-blur-md px-3 py-2 rounded-full border border-zinc-200/50 dark:border-zinc-800/50 transition-colors",
                  tocItems.length ? "hover:bg-white dark:hover:bg-zinc-950" : "opacity-40 cursor-not-allowed"
                )}
                type="button"
              >
                <List className="w-3 h-3 text-zinc-400" />
                <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
                  目录
                </span>
              </motion.button>
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
      )}

      {/* Navigation Buttons (Book Mode) */}
      <ChapterNavigator 
        prevArticleId={prevArticleId}
        nextArticleId={nextArticleId}
      />

      {/* Conditional Sidebar: Chapter List or TOC */}
      <AnimatePresence>
        {isTocOpen && (
          collection && tocMode === 'chapters' ? (
            <ChapterListSidebar
              collection={collection}
              currentArticleId={article.id}
              isOpen={isTocOpen}
              onClose={() => setIsTocOpen(false)}
            />
          ) : (
            (tocItems.length > 0) && (
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
                          i === activeTocIndex
                            ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-900/60 dark:text-zinc-50"
                            : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900/30"
                        )}
                        style={{ paddingLeft: 8 + Math.max(0, item.depth - 1) * 12 }}
                        type="button"
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

      {/* Floating TOC/Chapter Toggle Button (When BookInfoBar is present, we still need a way to open sidebar) */}
      {collection && (
        <div className="fixed top-3 right-6 z-50 flex items-center gap-3">
           <motion.button
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => setIsTocOpen((v) => !v)}
              className={twMerge(
                "pointer-events-auto flex items-center gap-2 bg-white/80 dark:bg-black/80 backdrop-blur-md px-3 py-2 rounded-full border border-zinc-200/50 dark:border-zinc-800/50 transition-colors hover:bg-white dark:hover:bg-zinc-950"
              )}
              type="button"
            >
              <List className="w-3 h-3 text-zinc-400" />
              <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
                章节
              </span>
            </motion.button>
            
            {/* Concept HUD also needed here */}
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
      )}

      {/* Reading Area */}
      <main 
        ref={containerRef}
        className="flex-1 relative overflow-y-auto flex flex-col items-center z-10 scroll-smooth no-scrollbar"
      >
        <div className="w-full max-w-2xl px-8 py-[40vh] flex flex-col gap-10">
          {sentences.map((sentence, index) => {
            // Optimization: Only render if within window
            if (index < renderStartIndex || index > renderEndIndex) {
                // Return a placeholder to maintain scroll position approximations?
                // Actually, for a focused reader, simply hiding them is cleaner, 
                // but standard scrollbar will jump.
                // Given the "Space to Read" flow, accurate scrollbar isn't critical.
                return null; 
            }
            
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
                        a: ({href, children}) => <span className="text-blue-500 hover:underline decoration-blue-500/30 cursor-pointer" onClick={() => window.open(href, '_blank')}>{children}</span>,
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

      {/* Contextual Hints (Related Concepts) */}
      <RelatedConcepts 
        currentText={currentSentenceText} 
        onConceptClick={(term) => {
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
              <div className="space-y-3">
                  {nextArticleId && (
                      <button
                        onClick={() => router.replace(`/read?id=${nextArticleId}`)}
                        className="w-full py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black rounded-xl font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                      >
                        下一章 <ChevronRight className="w-4 h-4" />
                      </button>
                  )}
                  <button
                    onClick={() => router.replace("/")}
                    className="w-full py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                  >
                    返回首页
                  </button>
              </div>
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
