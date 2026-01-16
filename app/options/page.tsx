"use client";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import * as articlesAPI from "@/lib/core/reading/articles.service";
import type { Article } from "@/lib/core/reading/articles.service";
import { StatsService } from "@/lib/core/reading/stats.service";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trash2,
  Download,
  Play,
  RotateCcw,
  Archive,
  Clock,
  FileText,
  Activity,
  Zap,
  AlertTriangle,
  ArrowLeft
} from "lucide-react";
import { twMerge } from "tailwind-merge";
// We'll try to dynamically import jszip to avoid build errors if not present
// import JSZip from "jszip";

export default function OptionsPage() {
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  const [mounted, setMounted] = useState(false);

  // Dialog state
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showConcept, setShowConcept] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const result = await articlesAPI.getArticles();
        setArticles(result.articles);
      } catch (error) {
        console.error('Failed to load articles:', error);
      }
      setStats([]); // TODO: Fetch from API or use useStats hook
      setMounted(true);
    };

    loadData();
  }, []);

  const statistics = useMemo(() => {
    const totalDurationMs = stats.reduce((acc, s) => acc + s.duration, 0);
    const totalMinutes = Math.floor(totalDurationMs / 60000);
    
    const finishedCount = articles.filter(a => (a.progress || 0) >= 99).length;
    
    // Avg speed: Total chars read / Total minutes
    // We need to estimate total chars read. 
    // Simplification: Sum of content length of articles that have been read?
    // Better: Store wordsRead in session. But we didn't.
    // Let's estimate: 
    // For each session, find article, get its length, multiply by progress delta? Too complex.
    // MVP: Total chars of ALL articles in library (approx) / Total time? No.
    // Let's use: Total chars of *finished* articles / Time spent on them?
    // Or simply: Total content length of all articles * (avg progress)?
    // Let's just sum up the content length of all articles for now as a base, 
    // maybe refined by progress.
    let totalChars = 0;
    articles.forEach(a => {
      const len = (a.content || "").length;
      const p = (a.progress || 0) / 100;
      totalChars += len * p;
    });
    
    const avgSpeed = totalMinutes > 0 ? Math.round(totalChars / totalMinutes) : 0;

    // Max continuous reading
    const maxSession = stats.reduce((max, s) => Math.max(max, s.duration), 0);
    const maxSessionMin = Math.floor(maxSession / 60000);

    return {
      totalMinutes,
      finishedCount,
      avgSpeed,
      maxSessionMin
    };
  }, [articles, stats]);

  async function handleDelete(id: string) {
    try {
      await articlesAPI.deleteArticle(id);
      const next = articles.filter(a => a.id !== id);
      setArticles(next);
      setDeleteId(null);
    } catch (error) {
      console.error('Failed to delete article:', error);
    }
  }

  function handleDownload(a: Article) {
    const content = `${a.title}\n\n${a.domain}\n\n${a.content || ""}`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${a.title.slice(0, 20)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function handleExportAll() {
    try {
      // Dynamically import jszip
      // If this fails, we might need to tell user to install it
      // const JSZip = (await import("jszip")).default;
      // The user said "no need to install ... anymore", so maybe I should just use it?
      // But if I can't install it, I can't import it.
      // I will assume it is NOT available and just show an alert or 
      // try to use it if by miracle it is there.
      // Actually, I'll use a CDN approach or just fail gracefully.
      // Since I can't use CDN in Next.js easily without script tag...
      // I'll just alert for now if not found.
      
      let JSZip: any;
      try {
        JSZip = (await import("jszip")).default;
      } catch (e) {
        alert("导出 ZIP 需要 jszip 库。请先运行 `npm install jszip`。");
        return;
      }

      const zip = new JSZip();
      articles.forEach(a => {
        const content = `${a.title}\n\n${a.domain}\n\n${a.content || ""}`;
        zip.file(`${a.id}_${a.title.slice(0, 10)}.txt`, content);
      });
      
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const link = document.createElement("a");
      link.href = url;
      link.download = `anti-ai-reader-backup-${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error(err);
      alert("导出失败");
    }
  }

  if (!mounted) return null;

  return (
    <div className="min-h-screen w-full bg-zinc-50 dark:bg-[#050505] text-zinc-900 dark:text-zinc-50 font-sans selection:bg-zinc-200 dark:selection:bg-zinc-800 pb-20">
      
      {/* Header */}
      <header className="px-6 py-8 md:px-12 md:py-12 max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-2">
          <button 
            onClick={() => router.push("/")}
            className="p-2 -ml-2 hover:bg-zinc-200 dark:hover:bg-zinc-900 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Archive className="w-6 h-6" />
            数据墓碑
          </h1>
        </div>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm max-w-lg ml-11">
          这里埋葬着你的阅读历史。所有数据仅存储在本地，清除浏览器数据将导致永久丢失。
        </p>
      </header>

      <main className="px-6 md:px-12 max-w-5xl mx-auto flex flex-col gap-12">
        
        {/* Stats Cards */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "累计阅读", value: `${statistics.totalMinutes}m`, icon: Clock },
            { label: "完成文章", value: statistics.finishedCount, icon: FileText },
            { label: "平均速度", value: `${statistics.avgSpeed}字/m`, icon: Activity },
            { label: "最长专注", value: `${statistics.maxSessionMin}m`, icon: Zap },
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 p-6 rounded-xl flex flex-col gap-2"
            >
              <stat.icon className="w-4 h-4 text-zinc-400" />
              <div className="text-2xl md:text-3xl font-bold font-mono">{stat.value}</div>
              <div className="text-xs text-zinc-500 uppercase tracking-wider">{stat.label}</div>
            </motion.div>
          ))}
        </section>

        {/* Actions */}
        <section className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <span>概念拓扑图</span>
              <button 
                onClick={() => setShowConcept(!showConcept)}
                className={`w-10 h-5 rounded-full relative transition-colors ${showConcept ? "bg-zinc-900 dark:bg-zinc-100" : "bg-zinc-200 dark:bg-zinc-800"}`}
              >
                <div className={`absolute top-1 w-3 h-3 rounded-full bg-white dark:bg-black transition-all ${showConcept ? "left-6" : "left-1"}`} />
              </button>
            </div>
            {showConcept && (
              <span className="text-xs text-zinc-500 animate-pulse">
                已隐藏 42 个概念节点
              </span>
            )}
          </div>

          <button
            onClick={handleExportAll}
            className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black text-sm font-medium rounded-lg flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            <Download className="w-4 h-4" />
            导出全部数据 (ZIP)
          </button>
        </section>

        {/* Article List */}
        <section className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400">
            文章档案 ({articles.length})
          </h2>
          
          <div className="flex flex-col gap-3">
            {articles.length === 0 ? (
              <div className="text-center py-20 text-zinc-400 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
                暂无数据
              </div>
            ) : (
              articles.map((article, i) => (
                <motion.div
                  key={article.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="group flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono text-zinc-400 uppercase border border-zinc-200 dark:border-zinc-800 px-1.5 py-0.5 rounded">
                        {article.domain}
                      </span>
                      <span className="text-[10px] text-zinc-400">
                        {new Date(article.lastRead).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="font-medium truncate">{article.title}</h3>
                  </div>

                  <div className="flex items-center gap-3 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                    {article.progress >= 99 ? (
                      <button
                        onClick={async () => {
                          // Reset and read
                          const updated = { ...article, progress: 0, lastReadSentence: 0 };
                          await articlesAPI.saveArticle(updated);
                          const next = articles.map(a => a.id === article.id ? updated : a);
                          setArticles(next);
                          router.push(`/read?id=${article.id}`);
                        }}
                        className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-lg transition-colors"
                        title="重新阅读"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => router.push(`/read?id=${article.id}`)}
                        className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-lg transition-colors"
                        title="继续阅读"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      onClick={() => handleDownload(article)}
                      className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-lg transition-colors"
                      title="导出 TXT"
                    >
                      <Download className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => setDeleteId(article.id)}
                      className="p-2 text-zinc-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </section>
      </main>

      {/* Custom Delete Dialog (Framer Motion) */}
      <AnimatePresence>
        {deleteId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteId(null)}
              className="absolute inset-0 bg-black/20 dark:bg-white/10 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 max-w-sm w-full"
            >
              <div className="flex items-center gap-3 text-red-600 mb-4">
                <AlertTriangle className="w-6 h-6" />
                <h3 className="text-lg font-bold">确认删除？</h3>
              </div>
              <p className="text-zinc-500 dark:text-zinc-400 mb-6 text-sm">
                此操作无法撤销。该文章及其阅读记录将被永久移除。
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setDeleteId(null)}
                  className="px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-sm font-medium hover:opacity-80"
                >
                  取消
                </button>
                <button
                  onClick={() => deleteId && handleDelete(deleteId)}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700"
                >
                  确认删除
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
