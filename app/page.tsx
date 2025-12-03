"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Article, getArticles, insertArticle, updateArticle } from "@/lib/articles";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Loader2, 
  Link as LinkIcon, 
  FileText, 
  Clock, 
  ArrowRight, 
  AlertCircle,
  History,
  Clipboard,
  Command,
  Activity
} from "lucide-react";
import { twMerge } from "tailwind-merge";
import { useConceptStore } from "@/lib/store/useConceptStore";

function formatRelative(ts: number) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "刚刚";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

function isUrl(input: string) {
  return /^(https?:\/\/)/i.test(input.trim());
}

function truncate(input: string, n = 20) {
  return input.length > n ? `${input.slice(0, n)}…` : input;
}

export default function Home() {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [list, setList] = useState<Article[]>([]);
  const [mounted, setMounted] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { concepts } = useConceptStore();

  useEffect(() => {
    setList(
      getArticles()
        .slice()
        .sort((a, b) => b.lastRead - a.lastRead)
    );
    setMounted(true);
    textareaRef.current?.focus();
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        handleSubmit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [value, loading]);

  const recentFive = useMemo(() => list.slice(0, 20), [list]); // Show more history
  const isInputUrl = useMemo(() => isUrl(value), [value]);

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setValue(text);
        textareaRef.current?.focus();
      }
    } catch (err) {
      setError("无法访问剪贴板，请手动粘贴");
    }
  }

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        const isMd = file.name.toLowerCase().endsWith(".md");
        const article: Article = {
          id: `file-${Date.now()}`,
          title: file.name,
          domain: "本地文件",
          content: content,
          progress: 0,
          lastRead: Date.now(),
          type: isMd ? 'markdown' : 'text'
        };
        updateList(article);
      }
    };
    reader.readAsText(file);
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }
  
  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }

  function onFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  async function handleSubmit() {
    const input = value.trim();
    if (!input || loading) return;
    
    setError("");
    setLoading(true);

    // Artificial delay for feel
    await new Promise(r => setTimeout(r, 300));

    try {
      if (isUrl(input)) {
        const res = await fetch("/api/fetch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: input }),
        });
        if (!res.ok) {
          throw new Error("不支持");
        }
        const data = await res.json();
        const article: Article = {
          id: data.id,
          title: data.title || input,
          domain: data.domain || "未知来源",
          url: input,
          content: data.content,
          progress: 0,
          lastRead: Date.now(),
          type: data.type || 'text',
        };
        updateList(article);
      } else {
        // Simple Markdown detection
        const isMd = /^(#|\- |\* |```|\[.+\]\(.+\)|> )/m.test(input);
        const article: Article = {
          id: `pasted-text-${Date.now()}`,
          title: truncate(input, 40),
          domain: "手动粘贴",
          content: input,
          progress: 0,
          lastRead: Date.now(),
          type: isMd ? 'markdown' : 'text',
        };
        updateList(article);
      }
      setValue("");
    } catch {
      setError("该网站不支持，请手动复制粘贴文本");
    } finally {
      setLoading(false);
    }
  }

  function updateList(article: Article) {
    const next = insertArticle(article)
      .slice()
      .sort((a, b) => b.lastRead - a.lastRead);
    setList(next);
  }

  function onClickItem(a: Article) {
    if (loading) return;
    window.location.href = `/read?id=${a.id}`;
  }

  if (!mounted) return null;

  return (
    <div className="h-screen w-full flex flex-col bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-50 font-sans overflow-hidden">
      {/* Main Layout: Split View */}
      <main className="flex-1 flex flex-col md:flex-row h-full overflow-hidden">
        
        {/* Left Panel: Input Console */}
        <section 
          className={twMerge(
            "w-full md:w-1/2 lg:w-[55%] flex flex-col p-6 md:p-12 relative z-10 bg-white dark:bg-black border-b md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-800 transition-colors duration-200",
            isDragging ? "bg-blue-50 dark:bg-blue-900/20 border-blue-500 dark:border-blue-500" : ""
          )}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".md,.txt"
            onChange={onFileSelect}
          />

          <motion.header 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 md:mb-auto"
          >
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <span className="w-2 h-2 bg-black dark:bg-white rounded-full inline-block"/>
              数字忏悔室
            </h1>
          </motion.header>

          <div className="flex-1 flex flex-col justify-center relative">
            {isDragging && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/50 dark:bg-black/50 backdrop-blur-sm rounded-xl border-2 border-dashed border-blue-500">
                <div className="text-blue-500 font-mono font-bold animate-pulse">DROP FILE HERE</div>
              </div>
            )}
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="relative group w-full"
            >
              <textarea
                ref={textareaRef}
                className="w-full h-[30vh] md:h-[40vh] bg-transparent text-2xl md:text-4xl font-mono leading-tight outline-none resize-none placeholder:text-zinc-200 dark:placeholder:text-zinc-800"
                placeholder="What do you want to read?"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                disabled={loading}
                spellCheck={false}
              />
              
              {/* Input Actions */}
              <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between">
                <div className="flex items-center gap-4">
                   {/* Type Indicator */}
                   <AnimatePresence>
                    {value && (
                      <motion.span
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className="text-xs font-mono text-zinc-400 px-2 py-1 bg-zinc-100 dark:bg-zinc-900 rounded"
                      >
                        {isInputUrl ? "LINK DETECTED" : "PLAIN TEXT"}
                      </motion.span>
                    )}
                  </AnimatePresence>
                  
                  {/* Error Message */}
                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className="flex items-center gap-2 text-xs text-red-500 font-mono bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded"
                      >
                        <AlertCircle className="w-3 h-3" />
                        {error}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="flex items-center gap-2">
                  {!value && (
                    <>
                      <motion.button
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => fileInputRef.current?.click()}
                        className="h-8 px-3 rounded bg-zinc-100 dark:bg-zinc-900 text-zinc-500 text-xs font-mono flex items-center gap-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                      >
                        <FileText className="w-3 h-3" />
                        IMPORT
                      </motion.button>

                      <motion.button
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handlePaste}
                        className="h-8 px-3 rounded bg-zinc-100 dark:bg-zinc-900 text-zinc-500 text-xs font-mono flex items-center gap-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                      >
                        <Clipboard className="w-3 h-3" />
                        PASTE
                      </motion.button>
                    </>
                  )}
                  
                  <button
                    onClick={handleSubmit}
                    disabled={!value || loading}
                    className="h-10 w-10 md:w-auto md:px-4 rounded-full md:rounded-lg bg-black dark:bg-white text-white dark:text-black disabled:opacity-0 transition-all flex items-center justify-center gap-2 group"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <span className="hidden md:inline font-medium text-sm">ENTER</span>
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>

          <motion.footer
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 1 }}
            className="fixed bottom-6 text-[10px] text-zinc-400 dark:text-zinc-600 font-mono select-none pointer-events-none"
          >
            ESC 退出后 · 可随时继续阅读
          </motion.footer>
        </section>

        {/* Right Panel: History Stream */}
        <section className="w-full md:w-1/2 lg:w-[45%] bg-zinc-50 dark:bg-[#050505] flex flex-col relative">
          <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/80 dark:bg-[#050505]/80 backdrop-blur z-10">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-400">
              <History className="w-3 h-3" />
              Log Stream
            </div>
            
            <div className="flex items-center gap-4">
                {/* Review Entry */}
                <a href="/review" className="flex items-center gap-1 text-[10px] font-mono text-purple-500 hover:text-purple-600 transition-colors group">
                    <Activity className="w-3 h-3 group-hover:animate-pulse" />
                    REVIEW
                </a>
                
                <span className="text-[10px] font-mono text-zinc-400 border-l border-zinc-200 dark:border-zinc-800 pl-4">
                    {list.length} RECORDS
                </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar relative">
            <AnimatePresence mode="popLayout" initial={false}>
              {recentFive.map((article, i) => {
                // Get concepts for this article
                const articleConcepts = Object.values(concepts).filter(c => c.sourceArticleId === article.id);
                
                return (
                <motion.button
                  layout
                  key={article.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => onClickItem(article)}
                  disabled={loading}
                  className="w-full group text-left p-4 rounded-lg bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 transition-all disabled:opacity-50 relative overflow-hidden"
                >
                  <div className="flex justify-between items-start gap-4 relative z-10">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-mono text-zinc-400 uppercase">
                          {article.domain}
                        </span>
                        <span className="text-[10px] text-zinc-300 dark:text-zinc-700">•</span>
                        <span className="text-[10px] font-mono text-zinc-400">
                          {formatRelative(article.lastRead)}
                        </span>
                      </div>
                      <h3 className="font-medium text-zinc-900 dark:text-zinc-100 truncate text-sm md:text-base mb-2">
                        {article.title}
                      </h3>
                      
                      {/* Concept Pills */}
                      {articleConcepts.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                              {articleConcepts.slice(0, 3).map((c, idx) => (
                                  <span key={idx} className="text-[10px] px-1.5 py-0.5 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded border border-purple-100 dark:border-purple-900/30 truncate max-w-[100px]">
                                      {c.term}
                                  </span>
                              ))}
                              {articleConcepts.length > 3 && (
                                  <span className="text-[10px] px-1.5 py-0.5 text-zinc-400">+{articleConcepts.length - 3}</span>
                              )}
                          </div>
                      )}
                    </div>
                    
                    <div className="flex flex-col items-end justify-between h-full">
                      {article.domain === "手动粘贴" ? (
                        <FileText className="w-4 h-4 text-zinc-300 dark:text-zinc-700" />
                      ) : (
                        <LinkIcon className="w-4 h-4 text-zinc-300 dark:text-zinc-700" />
                      )}
                    </div>
                  </div>

                  {/* Progress Bar Background */}
                  {article.progress > 0 && (
                    <div className="absolute bottom-0 left-0 h-1 bg-zinc-100 dark:bg-zinc-900 w-full">
                       <motion.div 
                        className="h-full bg-zinc-900 dark:bg-zinc-100"
                        initial={{ width: 0 }}
                        animate={{ width: `${article.progress}%` }}
                      />
                    </div>
                  )}
                </motion.button>
              )})}
              
              {recentFive.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-zinc-400 space-y-4 opacity-50 mt-20">
                  <div className="w-12 h-12 rounded-full border-2 border-dashed border-zinc-300 dark:border-zinc-700 flex items-center justify-center">
                    <ArrowRight className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-mono">WAITING FOR INPUT...</p>
                </div>
              )}
            </AnimatePresence>
            
            <div className="h-20" /> {/* Bottom spacer */}
          </div>
        </section>
      </main>
    </div>
  );
}
