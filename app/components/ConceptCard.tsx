"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, PenLine, Check, X, ChevronRight, ArrowLeft, Bookmark } from "lucide-react";
import { toast } from "sonner";
import { ConceptData } from "@/lib/store/useConceptStore";
import { Skeleton } from "@/app/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/hooks/query-keys";

interface ConceptCardProps {
  selection: string;
  position: { top: number; left: number };
  savedData?: ConceptData;
  onSave: (data: ConceptData) => void;
  onClose: () => void;
}

interface AIResponse {
  term: string;
  definition: string;
  example: string;
  related: string[];
}

async function fetchConcept(selection: string): Promise<AIResponse> {
  const res = await fetch("/api/concept", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ selection }),
  });
  if (!res.ok) throw new Error("Failed to fetch concept");
  return res.json();
}

// 卡片尺寸配置
const CARD_WIDTH = 320;
const CARD_HEIGHT_ESTIMATE = 400;
const VIEWPORT_PADDING = 16;

export function ConceptCard({ selection, position, savedData, onSave, onClose }: ConceptCardProps) {
  // Modes: 'loading' (initial) -> 'preview' (AI result) <-> 'edit' (User input) -> 'view' (Saved)
  const [mode, setMode] = useState<"loading" | "preview" | "edit" | "view">(
    savedData ? "view" : "loading"
  );

  // User Input State
  const [editStep, setEditStep] = useState<1 | 2>(1);
  const [myDefinition, setMyDefinition] = useState(savedData?.myDefinition || "");
  const [myExample, setMyExample] = useState(savedData?.myExample || "");
  const [confidence, setConfidence] = useState(savedData?.confidence || 3);

  const cardRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState({ top: 0, left: 0 });

  // Query for AI Data
  const { data: aiData, isLoading, isError, error } = useQuery({
    queryKey: queryKeys.concepts.aiDefinition(selection),
    queryFn: () => fetchConcept(selection),
    enabled: !savedData && mode === "loading", // Only fetch if not already saved
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
    retry: 2,
    retryDelay: 1000,
  });

  // Effect: Handle Mode Transitions based on Query State
  useEffect(() => {
    if (savedData) {
      setMode("view");
    } else if (isLoading) {
      setMode("loading");
    } else if (isError) {
      console.error("AI解析失败:", error);
      toast.error("AI 解析失败，请手动输入");
      setMode("edit");
    } else if (aiData) {
      setMode("preview");
      // Pre-fill user inputs with AI suggestions if empty
      if (!myDefinition) setMyDefinition(aiData.definition);
      if (!myExample) setMyExample(aiData.example);
    }
  }, [isLoading, isError, aiData, savedData, error, myDefinition, myExample]);

  // Smart Positioning (Keep inside viewport) with scroll handling
  const calculatePosition = useCallback(() => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // 初始位置：在点击位置下方显示
    let newTop = position.top + 20;
    let newLeft = position.left;

    // 水平边界检测
    if (newLeft + CARD_WIDTH > viewportWidth - VIEWPORT_PADDING) {
      newLeft = viewportWidth - CARD_WIDTH - VIEWPORT_PADDING;
    }
    if (newLeft < VIEWPORT_PADDING) {
      newLeft = VIEWPORT_PADDING;
    }

    // 垂直边界检测：优先显示在下方，空间不足则显示在上方
    if (newTop + CARD_HEIGHT_ESTIMATE > viewportHeight - VIEWPORT_PADDING) {
      newTop = Math.max(VIEWPORT_PADDING, position.top - CARD_HEIGHT_ESTIMATE - 20);
    }

    setAdjustedPosition({ top: newTop, left: newLeft });
  }, [position]);

  useEffect(() => {
    calculatePosition();
  }, [calculatePosition, mode]); // Recalculate when content changes

  // 滚动时重新计算位置
  useEffect(() => {
    const handleScroll = () => {
      calculatePosition();
    };

    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", calculatePosition);

    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", calculatePosition);
    };
  }, [calculatePosition]);

  // Handle Click Outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    // 延迟绑定点击外部事件，避免立即触发
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleSave = () => {
    if (myDefinition.length < 3) {
      toast.warning("定义至少需要3个字符");
      return;
    }
    onSave({
      term: aiData?.term || selection,
      myDefinition,
      myExample,
      myConnection: "User Created",
      confidence,
      createdAt: Date.now(),
      // Preserve AI data if available
      aiDefinition: aiData?.definition,
      aiExample: aiData?.example,
      aiRelatedConcepts: aiData?.related,
      isAiCollected: false,
    });
    onClose();
    toast.success("概念已保存");
  };

  const handleQuickCollect = () => {
    if (!aiData) return;
    onSave({
      term: aiData.term,
      // Use AI data for user fields if quick collecting, or keep them distinct?
      // Usually quick collect means "I accept AI's definition as mine" OR "I save AI's definition"
      // Based on schema, we have separate fields. 
      // Let's populate BOTH to ensure it shows up in "myDefinition" (which is required)
      myDefinition: aiData.definition, 
      myExample: aiData.example,
      myConnection: "AI Collected",
      confidence: 3,
      createdAt: Date.now(),
      // Also save to AI fields
      aiDefinition: aiData.definition,
      aiExample: aiData.example,
      aiRelatedConcepts: aiData.related,
      isAiCollected: true,
    });
    onClose();
    toast.success("快速收集成功");
  };

  // 进入编辑模式时重置步骤
  const enterEditMode = () => {
    setEditStep(1);
    setMode("edit");
  };

  // 从编辑返回预览
  const backToPreview = () => {
    if (aiData) {
      setMode("preview");
    } else {
      onClose();
    }
  };

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, scale: 0.9, y: 10, filter: "blur(8px)" }}
      animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, scale: 0.9, filter: "blur(8px)" }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      style={{
        top: adjustedPosition.top,
        left: adjustedPosition.left,
        maxHeight: `calc(100vh - ${VIEWPORT_PADDING * 2}px)`,
      }}
      className="fixed z-50 w-[300px] md:w-[320px] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl shadow-zinc-200/50 dark:shadow-black/50 overflow-hidden flex flex-col"
    >
      <AnimatePresence mode="wait">
        {mode === "loading" && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="p-6 space-y-4"
          >
            <div className="flex items-center gap-3 mb-2">
              <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
              <span className="text-sm font-medium text-zinc-500">AI 正在深度解析...</span>
            </div>
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </motion.div>
        )}

        {mode === "preview" && aiData && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="p-5 flex flex-col gap-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="font-serif text-xl font-bold text-zinc-900 dark:text-zinc-50 leading-tight truncate">
                  {aiData.term}
                </h3>
                <p className="text-[10px] text-zinc-400 mt-1 font-mono uppercase tracking-wider font-medium">AI 解析结果</p>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button
                  onClick={enterEditMode}
                  className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors focus-visible:ring-2 focus-visible:ring-purple-500 outline-none"
                  title="编辑笔记"
                >
                  <PenLine className="w-4 h-4" />
                </button>
                <button
                  onClick={handleQuickCollect}
                  className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors focus-visible:ring-2 focus-visible:ring-purple-500 outline-none"
                  title="快速收集"
                >
                  <Bookmark className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="relative pl-3">
              <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-purple-500/40 rounded-full" />
              <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                {aiData.definition}
              </p>
            </div>

            {aiData.example && (
              <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="font-medium">示例：</span>{aiData.example}
                </p>
              </div>
            )}

            {aiData.related && aiData.related.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                {aiData.related.slice(0, 3).map(tag => (
                  <span key={tag} className="text-[10px] px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded-full font-medium">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {mode === "edit" && (
          <motion.div
            key="edit"
            initial={{ opacity: 0, rotateY: 90 }} animate={{ opacity: 1, rotateY: 0 }} exit={{ opacity: 0, rotateY: -90 }}
            className="p-5 flex flex-col gap-4 bg-zinc-50/80 dark:bg-zinc-900/50 overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-2 border-b border-zinc-200/50 dark:border-zinc-800/50">
              <button
                onClick={() => editStep === 1 ? backToPreview() : setEditStep(1)}
                className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors font-medium"
              >
                <ArrowLeft className="w-3 h-3" /> {editStep === 1 ? "返回" : "上一步"}
              </button>
              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate max-w-[150px]">{aiData?.term || selection}</span>
            </div>

            <AnimatePresence mode="wait">
              {editStep === 1 ? (
                <motion.div
                  key="step1"
                  initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }}
                  className="space-y-3"
                >
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">用自己的话定义</label>
                    <span className={`text-[10px] font-mono ${myDefinition.length >= 10 ? 'text-green-500' : 'text-zinc-400'}`}>
                      {myDefinition.length} 字
                    </span>
                  </div>
                  <textarea
                    autoFocus
                    value={myDefinition}
                    onChange={(e) => setMyDefinition(e.target.value)}
                    placeholder="总结这个概念的核心含义..."
                    className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-3 text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none resize-none h-28 transition-all placeholder:text-zinc-400"
                  />
                  <button
                    onClick={() => setEditStep(2)}
                    disabled={myDefinition.length < 3}
                    className="w-full py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black rounded-xl text-sm font-semibold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-zinc-200/50 dark:shadow-black/50"
                  >
                    下一步 <ChevronRight className="w-4 h-4" />
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="step2"
                  initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">举例说明 (可选)</label>
                    <textarea
                      autoFocus
                      value={myExample}
                      onChange={(e) => setMyExample(e.target.value)}
                      placeholder="举一个具体的例子来帮助理解..."
                      className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-3 text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none resize-none h-24 transition-all placeholder:text-zinc-400"
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">掌握程度</label>
                      <span className="text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30 px-2 py-0.5 rounded-md">{confidence}/5</span>
                    </div>
                    <input
                      type="range" min="1" max="5"
                      value={confidence} onChange={(e) => setConfidence(Number(e.target.value))}
                      className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full accent-purple-600 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-zinc-400 font-medium px-1">
                      <span>陌生</span>
                      <span>了解</span>
                      <span>精通</span>
                    </div>
                  </div>

                  <button
                    onClick={handleSave}
                    className="w-full py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black rounded-xl text-sm font-semibold hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-zinc-200/50 dark:shadow-black/50"
                  >
                    <Check className="w-4 h-4" /> 完成并保存
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {mode === "view" && savedData && (
          <motion.div
            key="view"
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className="p-5 flex flex-col gap-4 overflow-y-auto"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="font-serif text-xl font-bold text-zinc-900 dark:text-zinc-50 leading-tight truncate">
                  {savedData.term}
                </h3>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-[10px] text-green-600 dark:text-green-400 font-mono uppercase tracking-wider font-bold bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded">已收集</span>
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < (savedData.confidence || 0) ? 'bg-purple-500' : 'bg-zinc-200 dark:bg-zinc-700'}`} />
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button
                  onClick={enterEditMode}
                  className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                  title="编辑"
                >
                  <PenLine className="w-4 h-4" />
                </button>
                <button
                  onClick={onClose}
                  className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-red-500 transition-colors"
                  title="关闭"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="relative pl-3">
                <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-green-500/40 rounded-full" />
                <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  {savedData.myDefinition}
                </p>
              </div>

              {savedData.myExample && (
                <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 italic">
                    &ldquo;{savedData.myExample}&rdquo;
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
