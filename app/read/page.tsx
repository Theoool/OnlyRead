"use client";
import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Article, getArticle, updateArticle } from "@/lib/articles";
import { recordSession } from "@/lib/stats";
import { motion, AnimatePresence } from "framer-motion";
import { twMerge } from "tailwind-merge";
import { Check, Lock, X, ArrowLeft, ChevronRight, BookOpen } from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";

function splitMarkdownBlocks(text: string): string[] {
  if (!text) return [];
  const lines = text.split(/\r?\n/);
  const blocks: string[] = [];
  let currentBlock: string[] = [];
  let inCodeBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();
    // Check for code block fence
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        // End of code block
        currentBlock.push(line);
        blocks.push(currentBlock.join('\n'));
        currentBlock = [];
        inCodeBlock = false;
      } else {
        // Start of code block
        // If we have pending text, push it first
        if (currentBlock.length > 0) {
           blocks.push(currentBlock.join('\n'));
           currentBlock = [];
        }
        inCodeBlock = true;
        currentBlock.push(line);
      }
    } else {
      if (inCodeBlock) {
        currentBlock.push(line);
      } else {
        if (trimmed === '') {
          // Empty line outside code block -> end of paragraph
          if (currentBlock.length > 0) {
            blocks.push(currentBlock.join('\n'));
            currentBlock = [];
          }
        } else {
          currentBlock.push(line);
        }
      }
    }
  }
  if (currentBlock.length > 0) {
    blocks.push(currentBlock.join('\n'));
  }
  
  return blocks.filter(b => b.trim().length > 0);
}

function splitSentences(text: string): string[] {
  if (!text) return [];
  // Split by . ! ? \n but keep delimiters
  const replaced = text
    .replace(/([。！？\n])/g, "$1|")
    .replace(/(\. )/g, ".|");
  return replaced.split("|").filter((s) => s.trim().length > 0);
}

function ReadContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get("id");
  const [article, setArticle] = useState<Article | null>(null);
  const [sentences, setSentences] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Debounce & Cooldown
  const lastNextTime = useRef<number>(0);
  const sessionStartTime = useRef<number>(Date.now());
  const [isCooldown, setIsCooldown] = useState(false);
  const [shake, setShake] = useState(0);
  const [cooldownProgress, setCooldownProgress] = useState(100);

  // Scroll ref
  const currentSentenceRef = useRef<HTMLParagraphElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) {
      router.replace("/");
      return;
    }
    const found = getArticle(id);
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
  }, [id, router]);

  // Auto scroll to center
  useEffect(() => {
    if (currentSentenceRef.current) {
      // Use a small timeout to ensure DOM layout is stable before scrolling
      // and avoid conflict with entry animations
      const timer = setTimeout(() => {
        currentSentenceRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 50);
      return () => clearTimeout(timer);
    }
    
    // Update progress
    if (article && sentences.length > 0) {
      const progress = ((currentIndex + 1) / sentences.length) * 100;
      updateArticle(article.id, {
        progress,
        lastReadSentence: currentIndex,
        lastRead: Date.now(),
      });
    }
    
    // Reset cooldown animation on new sentence
    setCooldownProgress(0);
    setIsCooldown(true);
    const currentSentence = sentences[currentIndex] || "";
    const minReadTime = 200 + (currentSentence.length * 20);
    
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
        const minReadTime = 200 + (currentSentence.length * 20);
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
    // Disable wheel
    const preventScroll = (e: Event) => e.preventDefault();
    window.addEventListener("wheel", preventScroll, { passive: false });
    window.addEventListener("touchmove", preventScroll, { passive: false });

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("wheel", preventScroll);
      window.removeEventListener("touchmove", preventScroll);
    };
  }, [currentIndex, sentences.length, router]);

  const [isFinished, setIsFinished] = useState(false);

  if (!article) return null;

  const progress = sentences.length > 0 
    ? ((currentIndex + 1) / sentences.length) * 100 
    : 0;

  return (
    <div className="h-screen w-full bg-[#FAFAFA] dark:bg-[#050505] text-zinc-900 dark:text-zinc-50 font-sans overflow-hidden flex flex-col selection:bg-zinc-900 selection:text-white dark:selection:bg-white dark:selection:text-black relative">
      
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
      </header>

      {/* Reading Area */}
      <main 
        ref={containerRef}
        className="flex-1 relative overflow-hidden flex flex-col items-center z-10"
      >
        <div className="w-full max-w-2xl px-8 py-[45vh] flex flex-col gap-10">
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
                  "relative group transition-all duration-500 ease-out my-8", // Static margin
                  "will-change-transform", // Hint for browser
                  article.type === 'markdown' ? "w-full" : ""
                )}
              >
                 {article.type === 'markdown' ? (
                  <div className={twMerge(
                    "text-lg md:text-xl leading-relaxed text-zinc-800 dark:text-zinc-200 transition-colors duration-300",
                    isCurrent ? "opacity-100" : "opacity-40 blur-[1px]"
                  )}>
                    <ReactMarkdown 
                      rehypePlugins={[rehypeHighlight]}
                      components={{
                        h1: ({children}) => <h1 className="text-3xl font-bold mt-8 mb-4 text-zinc-900 dark:text-zinc-50">{children}</h1>,
                        h2: ({children}) => <h2 className="text-2xl font-bold mt-6 mb-3 text-zinc-900 dark:text-zinc-50">{children}</h2>,
                        h3: ({children}) => <h3 className="text-xl font-bold mt-4 mb-2 text-zinc-900 dark:text-zinc-50">{children}</h3>,
                        p: ({children}) => <p className="mb-4 leading-relaxed">{children}</p>,
                        ul: ({children}) => <ul className="list-disc list-inside mb-4 pl-4 space-y-1">{children}</ul>,
                        ol: ({children}) => <ol className="list-decimal list-inside mb-4 pl-4 space-y-1">{children}</ol>,
                        li: ({children}) => <li className="mb-1">{children}</li>,
                        blockquote: ({children}) => <blockquote className="border-l-4 border-zinc-300 dark:border-zinc-700 pl-4 italic my-4 text-zinc-500 dark:text-zinc-400">{children}</blockquote>,
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
                        img: ({src, alt}) => <img src={src} alt={alt} className="max-w-full h-auto rounded-lg my-4 shadow-sm" />
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
                   {sentence}
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
