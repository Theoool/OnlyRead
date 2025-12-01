import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { twMerge } from "tailwind-merge";
import { Check, X, BookOpen } from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import "highlight.js/styles/github-dark.css";
import { parseDocument, ParsedContent } from "./lib/parser";
import { splitMarkdownBlocks } from "./lib/text-processing";

interface AppProps {
  onClose: () => void;
}

export default function App({ onClose }: AppProps) {
  const [parsed, setParsed] = useState<ParsedContent | null>(null);
  const [sentences, setSentences] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isFinished, setIsFinished] = useState(false);

  // Debounce & Cooldown
  const lastNextTime = useRef<number>(0);
  const [isCooldown, setIsCooldown] = useState(false);
  const [shake, setShake] = useState(0);
  const [cooldownProgress, setCooldownProgress] = useState(100);

  // Scroll ref
  const currentSentenceRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const result = parseDocument(document);
      if (result) {
        setParsed(result);
        const blocks = splitMarkdownBlocks(result.content);
        setSentences(blocks);
      }
    } catch (e) {
      console.error("Failed to parse document", e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto scroll to center
  useEffect(() => {
    if (currentSentenceRef.current) {
      const el = currentSentenceRef.current;
      const rect = el.getBoundingClientRect();
      // Extension viewport is the window
      const isLargeBlock = rect.height > window.innerHeight * 0.5;
      
      requestAnimationFrame(() => {
        el.scrollIntoView({
          behavior: "smooth",
          block: isLargeBlock ? "start" : "center",
        });
      });
    }
    
    // Reset cooldown animation on new sentence
    setCooldownProgress(0);
    setIsCooldown(true);
    const currentSentence = sentences[currentIndex] || "";
    
    // Smart Read Time
    let minReadTime = 200 + (currentSentence.length * 20);
    // Cap at 3s for Markdown blocks
    minReadTime = Math.min(minReadTime, 3000); 
    
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
  }, [currentIndex, sentences.length]);

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
        onClose();
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
        
        const currentSentence = sentences[currentIndex] || "";
        let minReadTime = 200 + (currentSentence.length * 20);
        minReadTime = Math.min(minReadTime, 3000);

        const now = Date.now();
        const timeSinceLast = now - lastNextTime.current;

        if (timeSinceLast < minReadTime) {
          setShake(prev => prev + 1);
          return;
        }

        if (currentIndex < sentences.length - 1) {
          lastNextTime.current = now;
          setCurrentIndex((prev) => prev + 1);
        } else {
          setIsFinished(true);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, { passive: false });
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [currentIndex, sentences.length, onClose]);

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#FAFAFA] dark:bg-[#050505]">
        <div className="w-6 h-6 border-2 border-zinc-900 dark:border-zinc-100 rounded-full animate-spin border-t-transparent"></div>
      </div>
    );
  }

  if (!parsed) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#FAFAFA] dark:bg-[#050505] flex-col gap-4">
        <p>无法解析此页面内容。</p>
        <button onClick={onClose} className="px-4 py-2 bg-zinc-900 text-white rounded">关闭</button>
      </div>
    );
  }

  const progress = sentences.length > 0 
    ? ((currentIndex + 1) / sentences.length) * 100 
    : 0;

  return (
    <div className="h-screen w-full bg-[#FAFAFA] dark:bg-black text-zinc-900 dark:text-zinc-50 font-sans overflow-hidden flex flex-col selection:bg-zinc-900 selection:text-white dark:selection:bg-white dark:selection:text-black relative">
      
      {/* Close Button */}
      <button 
        onClick={onClose}
        className="fixed top-6 right-6 z-[60] p-2 bg-white/80 dark:bg-black/80 backdrop-blur rounded-full border border-zinc-200 dark:border-zinc-800 hover:scale-110 transition-transform"
      >
        <X className="w-4 h-4 text-zinc-500" />
      </button>

      {/* Floating Header */}
      <header className="fixed top-0 left-0 right-0 h-[60px] flex items-center justify-between px-6 md:px-12 z-50 pointer-events-none">
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 bg-white/80 dark:bg-black/80 backdrop-blur-md px-4 py-2 rounded-full shadow-sm border border-zinc-200/50 dark:border-zinc-800/50"
        >
          <BookOpen className="w-3 h-3 text-zinc-400" />
          <h1 className="text-xs font-medium truncate max-w-[200px] opacity-80">
            {parsed.title}
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
        className="flex-1 relative overflow-y-auto flex flex-col items-center z-10 scroll-smooth no-scrollbar"
      >
        <div className="w-full max-w-2xl px-8 py-[40vh] flex flex-col gap-10">
          {sentences.map((sentence, index) => {
            const isVisible = index <= currentIndex;
            const isCurrent = index === currentIndex;
            
            if (!isVisible) return null;

            return (
              <motion.div
                key={index}
                ref={isCurrent ? currentSentenceRef : null}
                initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
                animate={{ 
                  opacity: isCurrent ? 1 : 0.2, 
                  y: 0, 
                  filter: isCurrent ? "blur(0px)" : "blur(1px)",
                  scale: isCurrent ? 1.05 : 1,
                  x: isCurrent && shake % 2 !== 0 ? [0, -4, 4, -4, 4, 0] : 0
                }}
                transition={{ 
                  duration: 0.4,
                  ease: "easeOut"
                }}
                className={twMerge(
                  "relative group transition-all duration-500 ease-out my-8 scroll-mt-24",
                  "will-change-transform",
                  "w-full"
                )}
              >
                  <div className={twMerge(
                    "text-lg md:text-xl leading-relaxed text-zinc-800 dark:text-zinc-200 transition-colors duration-300",
                    isCurrent ? "opacity-100" : "opacity-50"
                  )}>
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
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
                        img: ({src, alt}) => <img src={src} alt={alt} className="max-w-full h-auto rounded-lg my-4 shadow-sm" />,
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
                onClick={onClose}
                className="w-full py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black rounded-xl font-medium hover:opacity-90 transition-opacity"
              >
                关闭阅读器
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
