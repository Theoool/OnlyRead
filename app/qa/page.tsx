"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, 
  Send, 
  Loader2, 
  BookOpen, 
  Quote, 
  AlertCircle,
  Sparkles,
  HelpCircle
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { twMerge } from "tailwind-merge";

interface Citation {
  articleId: string;
  title: string;
  quote: string;
}

interface Source {
  articleId: string;
  title: string;
  domain: string | null;
  similarity: number;
  excerpt: string;
}

interface QAResponse {
  answer: string;
  confidence: number;
  citations: Citation[];
  followUpQuestions: string[];
  sources: Source[];
}

export default function QAPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<QAResponse | null>(null);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  
  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  }, [question]);

  const handleSearch = async () => {
    if (!question.trim() || loading) return;
    
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim() }),
      });

      if (!res.ok) {
        throw new Error("Failed to fetch answer");
      }

      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      setResult(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      handleSearch();
    }
  };

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-50 font-sans flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <button 
            onClick={() => router.back()}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-bold text-sm tracking-wider uppercase flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-500" />
            知识问答
          </h1>
          <div className="w-9" /> {/* Spacer */}
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 flex flex-col gap-8">
        {/* Input Section */}
        <section className="relative">
          <div className="relative group">
            <textarea
              ref={textareaRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="询问关于你知识库的任何问题..."
              className="w-full min-h-[120px] p-6 pr-16 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all resize-none text-lg leading-relaxed placeholder:text-zinc-400"
            />
            <div className="absolute bottom-4 right-4">
              <button
                onClick={handleSearch}
                disabled={!question.trim() || loading}
                className="p-3 bg-black dark:bg-white text-white dark:text-black rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg active:scale-95"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
          <div className="mt-2 text-xs text-zinc-400 text-right font-mono">
            Cmd + Enter 发送
          </div>
        </section>

        {/* Error State */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 rounded-xl border border-red-100 dark:border-red-900/20 flex items-center gap-3"
            >
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-sm">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Result Section */}
        <AnimatePresence mode="wait">
          {result && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="space-y-8"
            >
              {/* Answer Card */}
              <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 md:p-8 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">AI Answer</span>
                    <span className={twMerge(
                      "text-xs px-2 py-0.5 rounded-full font-mono border",
                      result.confidence > 0.7 
                        ? "bg-green-50 text-green-600 border-green-200 dark:bg-green-900/20 dark:border-green-900/30"
                        : result.confidence > 0.4
                        ? "bg-yellow-50 text-yellow-600 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-900/30"
                        : "bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:border-red-900/30"
                    )}>
                      {Math.round(result.confidence * 100)}% Confidence
                    </span>
                  </div>
                </div>

                <div className="prose dark:prose-invert max-w-none text-zinc-800 dark:text-zinc-200 leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {result.answer}
                  </ReactMarkdown>
                </div>

                {/* Citations */}
                {result.citations.length > 0 && (
                  <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800">
                    <h3 className="text-xs font-bold uppercase text-zinc-400 mb-4 flex items-center gap-2">
                      <Quote className="w-3 h-3" />
                      Citations
                    </h3>
                    <div className="grid gap-3">
                      {result.citations.map((citation, idx) => (
                        <button
                          key={idx}
                          onClick={() => router.push(`/read?id=${citation.articleId}`)}
                          className="text-left group p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors border border-zinc-100 dark:border-zinc-800"
                        >
                          <div className="flex items-start gap-3">
                            <span className="text-xs font-mono text-zinc-400 mt-0.5">[{idx + 1}]</span>
                            <div>
                              <p className="text-sm text-zinc-600 dark:text-zinc-400 italic mb-1">
                                "{citation.quote}"
                              </p>
                              <p className="text-xs font-medium text-zinc-900 dark:text-zinc-300 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                                — {citation.title}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Follow-up Questions */}
              {result.followUpQuestions?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {result.followUpQuestions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setQuestion(q);
                        // Optional: auto trigger search? 
                        // For now let user review and hit enter
                      }}
                      className="px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full text-sm text-zinc-600 dark:text-zinc-400 hover:border-purple-500 hover:text-purple-600 dark:hover:border-purple-500 dark:hover:text-purple-400 transition-colors flex items-center gap-2"
                    >
                      <HelpCircle className="w-4 h-4" />
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {/* Sources Evidence */}
              <div className="bg-zinc-100/50 dark:bg-zinc-900/30 rounded-2xl p-6">
                 <h3 className="text-xs font-bold uppercase text-zinc-400 mb-4 flex items-center gap-2">
                    <BookOpen className="w-3 h-3" />
                    来源证据 ({result.sources.length})
                  </h3>
                  <div className="space-y-3">
                    {result.sources.map((source, idx) => (
                      <div key={idx} className="p-3 rounded-lg border border-zinc-200/50 dark:border-zinc-800/50 bg-white/50 dark:bg-black/20">
                        <div className="flex justify-between items-start mb-2">
                           <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                             {source.title}
                           </h4>
                           <span className="text-[10px] font-mono text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                             {Math.round(source.similarity * 100)}% 匹配度
                           </span>
                        </div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                          {source.excerpt}
                        </p>
                      </div>
                    ))}
                  </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
