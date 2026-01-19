"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Article } from "@/lib/core/reading/articles.service";
import type { Collection } from "@/lib/core/reading/collections.service";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  Link as LinkIcon,
  FileText,
  ArrowRight,
  AlertCircle,
  History,
  Clipboard,
  Command,
  Activity,
  TrendingUp,
  Brain,
  Sparkles,
  Flame,
  Book,
  Library,
  ChevronDown,
  ChevronRight,
  Upload,
  Check,
  Circle,
} from "lucide-react";
import { twMerge } from "tailwind-merge";
import { useConceptStore, ConceptData } from "@/lib/store/useConceptStore";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { createClient } from "@/lib/supabase/client";
import { SearchBar } from "@/app/components/SearchBar";
import { User, LogOut } from "lucide-react";
import { useRouter } from 'next/navigation';
import { useArticles, useSaveArticle } from "@/lib/hooks/use-articles";
import { useCollections } from "@/lib/hooks/use-collections";
import { ArticleListSkeleton } from "@/app/components/ui/skeleton";
import { db } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";

function formatRelative(ts: number) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "刚刚";
  if (m < 60) return `${m}分钟`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}小时`;
  const d = Math.floor(h / 24);
  return `${d}天`;
}

function isUrl(input: string) {
  return /^(https?:\/\/)/i.test(input.trim());
}

function truncate(input: string, n = 20) {
  return input.length > n ? `${input.slice(0, n)}…` : input;
}

export default function Home() {
  const { isAuthenticated, user, logout, fetchSession, isLoading } = useAuthStore();
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { concepts, loadConcepts } = useConceptStore();
  const router = useRouter();
  
  // View Mode: 'articles' | 'collections'
  const [viewMode, setViewMode] = useState<'articles' | 'collections'>('articles');
  const [expandedCollectionId, setExpandedCollectionId] = useState<string | null>(null);
  const [expandedCollections, setExpandedCollections] = useState<Map<string, any[]>>(new Map());

  // React Query Hooks
  const { data: articlesData = { articles: [] }, isLoading: isLoadingArticles, refetch: refetchArticles } = useArticles();
  const { data: collections = [], isLoading: isLoadingCollections, refetch: refetchCollections } = useCollections();
  const saveArticleMutation = useSaveArticle();

  // Extract articles from response
  const articles = articlesData.articles || [];

  // Sort articles by lastRead
  const sortedArticles = useMemo(() => {
    return [...articles].sort((a, b) => (b.lastRead || 0) - (a.lastRead || 0));
  }, [articles]);

  // Display more articles or limit to 20
  const [displayLimit, setDisplayLimit] = useState(20);
  const displayedArticles = useMemo(() => sortedArticles.slice(0, displayLimit), [sortedArticles, displayLimit]);

  const localBooks = useLiveQuery(() => db.books.toArray()) || [];

  const sortedCollections = useMemo(() => {
    const remote = collections.map((c: any) => ({ ...c, isLocal: false }));
    const local = localBooks.map(b => ({
      id: b.id,
      title: b.title,
      updatedAt: new Date(b.addedAt).toISOString(),
      _count: { articles: 1 },
      isLocal: true,
      format: b.format
    }));
    return [...remote, ...local].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [collections, localBooks]);

  // Quick stats state
  const [quickStats, setQuickStats] = useState<{
    dueCount: number;
    currentStreak: number;
    totalConcepts: number;
  } | null>(null);

  // Initial Data Load (Non-blocking)
  useEffect(() => {
    const init = async () => {
      // Fetch session in background
      fetchSession();

      // Load concepts if authenticated
      if (isAuthenticated) {
        loadConcepts();
      }
    };
    init();
    
    // Focus input on mount
    textareaRef.current?.focus();
    
    // Fetch quick stats separately
    fetchQuickStats();
  }, [isAuthenticated]); // Re-run if auth state changes

  // Load collection articles when expanded
  useEffect(() => {
    if (expandedCollectionId && !expandedCollections.has(expandedCollectionId)) {
      handleOpenCollection(expandedCollectionId);
    }
  }, [expandedCollectionId]);

  const fetchQuickStats = async () => {
    try {
      const [masteryRes, learningRes] = await Promise.all([
        fetch('/api/stats/mastery', { credentials: 'include' }),
        fetch('/api/stats/learning?period=all', { credentials: 'include' }),
      ]);

      if (masteryRes.ok && learningRes.ok) {
        const mastery = await masteryRes.json();
        const learning = await learningRes.json();

        setQuickStats({
          dueCount: mastery.dueCount || 0,
          currentStreak: learning.currentStreak || 0,
          totalConcepts: learning.totalConcepts || 0,
        });
      }
    } catch (error) {
      console.error('Failed to fetch quick stats:', error);
    }
  };

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

  const recentFive = useMemo(() => displayedArticles, [displayedArticles]);
  const isInputUrl = useMemo(() => isUrl(value), [value]);

  // Build a map for efficient concept lookup by article ID
  // This avoids O(n*m) complexity when filtering concepts for each article
  const conceptsByArticle = useMemo(() => {
    const map = new Map<string, ConceptData[]>();
    Object.values(concepts).forEach(concept => {
      if (concept.sourceArticleId) {
        const existing = map.get(concept.sourceArticleId) || [];
        existing.push(concept);
        map.set(concept.sourceArticleId, existing);
      }
    });
    return map;
  }, [concepts]);

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

  async function handleFile(file: File) {
    if (!user) {
      setError("请先登录以上传文件");
      return;
    }

    setLoading(true);
    setError("");
    
    try {
      // 1. Check file type
      const isEpub = file.name.toLowerCase().endsWith('.epub');
      const isPdf = file.name.toLowerCase().endsWith('.pdf');
      const isMd = file.name.toLowerCase().endsWith('.md');
      const isTxt = file.name.toLowerCase().endsWith('.txt');

      if (!isEpub && !isPdf && !isMd && !isTxt) {
        throw new Error("不支持的文件格式。请上传 .epub, .pdf, .md, 或 .txt");
      }

      // Define Background Upload Task (Fire-and-forget for local files)
      const performBackgroundUpload = async () => {
         try {
             console.log('[Background] Starting upload for', file.name);
             const supabase = createClient();
             // Sanitize file name
             const sanitizedFileName = file.name.replace(/[^\x00-\x7F]/g, "").replace(/\s+/g, "_");
             const filePath = `${user.id}/${Date.now()}_${sanitizedFileName}`;

             // A. Upload to Supabase
             const { error: uploadError } = await supabase.storage
               .from('files')
               .upload(filePath, file);

             if (uploadError) {
                console.error('Supabase upload error:', uploadError);
                throw new Error(`上传失败: ${uploadError.message}`);
             }

             // B. Trigger Backend Import
             const res = await fetch('/api/import/file', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ 
                 filePath, 
                 originalName: file.name,
                 fileType: file.type
               }),
             });

             if (!res.ok) {
               const errorData = await res.json();
               throw new Error(errorData.error || 'Process failed');
             }

             const data = await res.json();
             
             // C. Refresh remote data
             await Promise.all([refetchArticles(), refetchCollections()]);
             
             // D. Feedback based on mode
             if (isEpub || isPdf) {
                 // Parallel mode: Notify user via toast
                 toast.success("AI 分析准备就绪", { 
                    description: "文档已同步并完成后台处理，AI 功能现已可用" 
                 });
             } else {
                 // Serial mode: Switch view
                 if (data.data.collection) {
                    setViewMode('collections');
                 } else {
                    setViewMode('articles');
                 }
             }
             
         } catch (bgError: any) {
             console.error("[Background] Upload failed", bgError);
             if (isEpub || isPdf) {
                 toast.error("AI 分析同步失败", { description: bgError.message });
             } else {
                 throw bgError; // Re-throw for serial mode to catch
             }
         }
      };

      // 2. Execution Strategy
      if (isEpub || isPdf) {
          // === Parallel Mode (Local First) ===
          
          // Step A: Local IndexedDB (Blocking UI for instant feedback)
          const arrayBuffer = await file.arrayBuffer();
          const id = crypto.randomUUID();
          
          await db.books.add({
            id,
            title: file.name.replace(/\.(epub|pdf)$/i, ''),
            author: 'Local File',
            fileData: arrayBuffer,
            format: isEpub ? 'epub' : 'pdf',
            addedAt: Date.now(),
            progress: 0
          });
          
          // Step B: Release UI immediately
          setViewMode('collections');
          setLoading(false); 
          
          // Step C: Trigger Background Upload (No await)
          performBackgroundUpload(); 
          
      } else {
          // === Serial Mode (Remote Only) ===
          // MD/TXT currently has no local reader, so we wait
          await performBackgroundUpload();
          setLoading(false);
      }
      
    } catch (err: any) {
      console.error('File handling error:', err);
      setError(err.message || "文件处理失败");
      setLoading(false);
    }
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

    try {
      if (isUrl(input)) {
        const res = await fetch("/api/import/url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: input }),
        });
        
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Import failed");
        }
        
        await refetchArticles();
        setViewMode('articles');
        setValue("");
      } else {
        // Text Paste
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
        await saveArticle(article);
        await refetchArticles();
        setValue("");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "该网站不支持，请手动复制粘贴文本");
    } finally {
      setLoading(false);
    }
  }

  async function saveArticle(article: Article) {
    try {
      await saveArticleMutation.mutateAsync(article);
    } catch (error) {
      console.error('Failed to save article:', error);
      setError('保存失败，请重试');
    }
  }

  function onClickItem(a: Article) {
    if (loading) return;
    router.push(`/read?id=${a.id}`);
  }

  async function handleOpenCollection(collectionId: string) {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`/api/collections/${collectionId}`);
      if (!res.ok) throw new Error("加载合集失败");
      const data = await res.json();

      if (!data.collection) throw new Error("合集数据缺失");

      const articles = data.collection.articles;
            console.log(
              "articles",
              articles
            );
            
      if (articles && articles.length > 0) {
        // Store articles in state
        setExpandedCollections(prev => new Map(prev).set(collectionId, articles));
      } else {
        setError("本书为空");
      }
    } catch (e) {
      console.error(e);
      setError("打开书籍失败");
    } finally {
      setLoading(false);
    }
  }

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
            className="mb-6 flex items-center justify-between"
          >
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <span className="w-2 h-2 bg-black dark:bg-white rounded-full inline-block"/>
              阅读
            </h1>

            {/* Auth UI */}
            <div className="flex items-center gap-3">
              {isAuthenticated && user ? (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    {user.avatarUrl && (
                      <img
                        src={user.avatarUrl}
                        alt={user.fullName || user.email}
                        className="w-6 h-6 rounded-full"
                      />
                    )}
                    <span className="text-zinc-600 dark:text-zinc-400">
                      {user.fullName || user.email?.split('@')[0]}
                    </span>
                  </div>
                  <button
                    onClick={async () => {
                      await logout();
                      window.location.href = '/';
                    }}
                    disabled={isLoading}
                    className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50"
                    title="Logout"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => window.location.href = '/auth'}
                  className="flex items-center gap-2 px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
                >
                  <User className="w-4 h-4" />
                  登录
                </button>
              )}
            </div>
          </motion.header>

          {/* Quick Stats */}
          {quickStats && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="grid grid-cols-3 gap-3 mb-6"
            >
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 border border-purple-100 dark:border-purple-900/30">
                <div className="flex items-center gap-2 mb-1">
                  <Brain className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                  <span className="text-xs font-medium text-purple-600 dark:text-purple-400">复习</span>
                </div>
                <div className="text-lg font-bold text-zinc-900 dark:text-white">{quickStats.dueCount}</div>
              </div>
              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 border border-orange-100 dark:border-orange-900/30">
                <div className="flex items-center gap-2 mb-1">
                  <Flame className="w-3 h-3 text-orange-600 dark:text-orange-400" />
                  <span className="text-xs font-medium text-orange-600 dark:text-orange-400">连续打卡</span>
                </div>
                <div className="text-lg font-bold text-zinc-900 dark:text-white">{quickStats.currentStreak}</div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-100 dark:border-blue-900/30">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-medium text-blue-600 dark:text-blue-400">卡片</span>
                </div>
                <div className="text-lg font-bold text-zinc-900 dark:text-white">{quickStats.totalConcepts}</div>
              </div>
            </motion.div>
          )}

          {/* Search Bar */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mb-6"
          >
            <SearchBar />
          </motion.div>

          <div className="flex-1 flex flex-col justify-center relative">
            {isDragging && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/50 dark:bg-black/50 backdrop-blur-sm rounded-xl border-2 border-dashed border-blue-500">
                <div className="text-blue-500 font-mono font-bold animate-pulse">释放文件</div>
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
                placeholder="你想阅读什么？"
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
                        {isInputUrl ? "检测到链接" : "纯文本"}
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
                        导入
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
                        粘贴
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
                        <span className="hidden md:inline font-medium text-sm">进入</span>
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
            <div className="flex items-center gap-4">
               <button 
                  onClick={() => setViewMode('articles')}
                  className={twMerge(
                    "flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors",
                    viewMode === 'articles' ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400 hover:text-zinc-600"
                  )}
               >
                 <History className="w-3 h-3" />
                 文章
               </button>
               <button 
                  onClick={() => setViewMode('collections')}
                  className={twMerge(
                    "flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors",
                    viewMode === 'collections' ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400 hover:text-zinc-600"
                  )}
               >
                 <Library className="w-3 h-3" />
                 书籍
               </button>
            </div>
            
            <div className="flex items-center gap-4">
                {/* Stats Link */}
                <a href="/stats" className="flex items-center gap-1 text-[10px] font-mono text-blue-500 hover:text-blue-600 transition-colors group">
                    <TrendingUp className="w-3 h-3" />
                    统计
                </a>

                {/* Review Entry */}
                <a href="/review" className="flex items-center gap-1 text-[10px] font-mono text-purple-500 hover:text-purple-600 transition-colors group">
                    <Activity className="w-3 h-3 group-hover:animate-pulse" />
                    复习
                </a>

                {/* QA Entry */}
                <a href="/qa" className="flex items-center gap-1 text-[10px] font-mono text-indigo-500 hover:text-indigo-600 transition-colors group">
                    <Sparkles className="w-3 h-3 group-hover:animate-pulse" />
                    问答
                </a>

                {/* Search Link */}
                <a href="/search" className="flex items-center gap-1 text-[10px] font-mono text-zinc-500 hover:text-zinc-600 transition-colors">
                    <Command className="w-3 h-3" />
                    搜索
                </a>

                <span className="text-[10px] font-mono text-zinc-400 border-l border-zinc-200 dark:border-zinc-800 pl-4">
                    {viewMode === 'articles' ? articles.length : collections.length} 记录
                </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar relative">
            {viewMode === 'articles' ? (
                isLoadingArticles ? (
                  <ArticleListSkeleton />
                ) : (
                  <AnimatePresence mode="popLayout" initial={false}>
                    {recentFive.map((article, i) => {
                      // Get concepts for this article using O(1) lookup
                      const articleConcepts = conceptsByArticle.get(article.id) || [];
                      
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
                        <p className="text-xs font-mono">等待输入...</p>
                      </div>
                    )}
                  </AnimatePresence>
                )
            ) : (
              // Collections View
              isLoadingCollections ? (
                  <ArticleListSkeleton />
              ) : (
                  <AnimatePresence mode="popLayout" initial={false}>
                      {sortedCollections.map((collection, i) => (
                          <motion.div
                              layout
                              key={collection.id}
                              initial={{ opacity: 0, x: 20 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 20 }}
                              transition={{ delay: i * 0.05 }}
                              className="w-full group text-left p-4 rounded-lg bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 transition-all relative overflow-hidden"
                          >
                              <div
                                className="flex justify-between items-start cursor-pointer"
                                onClick={() => {
                                  if (collection.isLocal) {
                                     router.push(`/read?localId=${collection.id}`);
                                     return;
                                  }
                                  const newExpandedId = expandedCollectionId === collection.id ? null : collection.id;
                                  setExpandedCollectionId(newExpandedId);
                                }}
                              >
                                  <div className="flex items-center gap-3">
                                      <div className="p-2 bg-zinc-100 dark:bg-zinc-900 rounded text-zinc-500">
                                          <Book className="w-4 h-4" />
                                      </div>
                                      <div>
                                          <h3 className="font-medium text-zinc-900 dark:text-zinc-100 text-sm md:text-base">
                                              {collection.title}
                                          </h3>
                                          <p className="text-xs text-zinc-500 mt-1">
                                              {collection.isLocal ? '本地文件' : `${collection._count?.articles || 0} 章`} • {formatRelative(new Date(collection.updatedAt).getTime())}
                                          </p>
                                      </div>
                                  </div>
                                  {!collection.isLocal && (
                                  <ChevronDown className={twMerge(
                                      "w-4 h-4 text-zinc-400 transition-transform",
                                      expandedCollectionId === collection.id ? "rotate-180" : ""
                                  )} />
                                  )}
                              </div>

                              <AnimatePresence>
                                  {expandedCollectionId === collection.id && (
                                      <motion.div
                                          initial={{ height: 0, opacity: 0 }}
                                          animate={{ height: "auto", opacity: 1 }}
                                          exit={{ height: 0, opacity: 0 }}
                                          className="overflow-hidden"
                                      >
                                          <div className="mt-4 pl-4 border-l border-zinc-200 dark:border-zinc-800 space-y-1">
                                              {/* Show chapter list */}
                                              {!expandedCollections.has(collection.id) ? (
                                                  /* Loading state */
                                                  <div className="flex justify-center py-4">
                                                    <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                                                  </div>
                                              ) : (
                                                  expandedCollections.get(collection.id)!.map((article: any, idx: number) => (
                                                      <button
                                                          key={article.id}
                                                          onClick={(e) => {
                                                              e.stopPropagation();
                                                              router.push(`/read?id=${article.id}`);
                                                          }}
                                                          className="w-full text-left group py-2 px-3 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center justify-between"
                                                      >
                                                          <div className="flex items-center gap-3 flex-1 min-w-0">
                                                              <span className="text-[10px] font-mono text-zinc-400">
                                                                  {String(idx + 1).padStart(2, '0')}
                                                              </span>
                                                              <span className="text-sm text-zinc-700 dark:text-zinc-300 truncate flex-1">
                                                                  {article.title}
                                                              </span>
                                                              {article.progress > 0 && (
                                                                  <span className="text-[10px] text-zinc-400">
                                                                      {article.progress}%
                                                                  </span>
                                                              )}
                                                          </div>
                                                          {article.progress === 100 ? (
                                                              <Check className="w-3 h-3 text-green-500 flex-shrink-0" />
                                                          ) : (
                                                              <ChevronRight className="w-3 h-3 text-zinc-400 flex-shrink-0" />
                                                          )}
                                                      </button>
                                                  ))
                                              )}

                                              {/* Error state */}
                                              {error && expandedCollectionId === collection.id && (
                                                <div className="text-xs text-red-500 text-center py-2">
                                                  {error}
                                                </div>
                                              )}
                                          </div>
                                      </motion.div>
                                  )}
                              </AnimatePresence>
                          </motion.div>
                      ))}
                      
                      {sortedCollections.length === 0 && (
                          <div className="h-full flex flex-col items-center justify-center text-zinc-400 space-y-4 opacity-50 mt-20">
                              <div className="w-12 h-12 rounded-full border-2 border-dashed border-zinc-300 dark:border-zinc-700 flex items-center justify-center">
                                  <Book className="w-5 h-5" />
                              </div>
                              <p className="text-xs font-mono">未找到书籍</p>
                          </div>
                      )}
                  </AnimatePresence>
              )
            )}

            {/* Load More Button */}
            {viewMode === 'articles' && displayedArticles.length < sortedArticles.length && (
              <div className="px-4 pb-4">
                <button
                  onClick={() => setDisplayLimit(prev => prev + 20)}
                  className="w-full py-3 px-4 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors text-sm font-medium text-zinc-600 dark:text-zinc-400 flex items-center justify-center gap-2"
                >
                  加载更多 ({sortedArticles.length - displayedArticles.length} 篇)
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="h-20" /> {/* Bottom spacer */}
          </div>
        </section>
      </main>
    </div>
  );
}
