import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useArticle, useUpdateArticleProgress, useArticleNavigation } from "@/lib/hooks";
import { splitMarkdownBlocks, splitSentences } from "@/lib/text-processing";
import { getCollection, Collection } from "@/lib/core/reading/collections.service";
import type { Article } from "@/lib/core/reading/articles.service";

// 统一冷却管理 Hook
function useCooldown(sentences: string[], currentIndex: number, type?: string) {
  const [progress, setProgress] = useState(100);
  const [isActive, setIsActive] = useState(false);
  const [shake, setShake] = useState(0);
  const untilRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  const getMinReadTime = useCallback((sentence: string) => {
    const base = 200 + sentence.length * 20;
    return type === 'markdown' ? Math.min(base, 3000) : base;
  }, [type]);

  const start = useCallback(() => {
    const sentence = sentences[currentIndex] || "";
    const duration = getMinReadTime(sentence);
    const startTime = Date.now();
    untilRef.current = startTime + duration;
    
    setIsActive(true);
    setProgress(0);

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const p = Math.min(100, (elapsed / duration) * 100);
      setProgress(p);
      
      if (p < 100) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setIsActive(false);
      }
    };
    
    rafRef.current = requestAnimationFrame(animate);
  }, [sentences, currentIndex, getMinReadTime]);

  const check = useCallback(() => {
    const now = Date.now();
    const allowed = now >= untilRef.current;
    if (!allowed) setShake(s => s + 1);
    return allowed;
  }, []);

  const reset = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setProgress(100);
    setIsActive(false);
  }, []);

  useEffect(() => {
    start();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [currentIndex, start]);

  return { progress, isActive, shake, check, reset };
}

// 统一进度保存 Hook
function useProgressSaver(
  article: Article | undefined, 
  currentIndexRef: React.MutableRefObject<number>,
  sentencesLength: number
) {
  const updateProgressMutation = useUpdateArticleProgress();
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isUnloadingRef = useRef(false);

  const save = useCallback((isFinal = false) => {
    if (!article || isUnloadingRef.current) return;
    
    const index = currentIndexRef.current;
    const progress = isFinal ? 100 : ((index + 1) / sentencesLength) * 100;
    
    updateProgressMutation.mutate({
      id: article.id,
      progress,
      lastReadSentence: index,
      lastRead: Date.now(),
      skipInvalidation: !isFinal
    });
  }, [article, sentencesLength, updateProgressMutation, currentIndexRef]);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => save(false), 2000);
  }, [save]);

  const saveImmediately = useCallback((isFinal = false) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    save(isFinal);
  }, [save]);

  useEffect(() => {
    return () => {
      isUnloadingRef.current = true;
      saveImmediately();
    };
  }, [saveImmediately]);

  return { scheduleSave, saveImmediately };
}

export function useReadingLogic(initialArticle?: Article) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const localId = searchParams.get("localId");

  const { data: article, isLoading: isLoadingArticle, error: articleError } = 
    useArticle(id || "", { initialData: initialArticle });

  // 核心状态
  const [sentences, setSentences] = useState<string[]>([]);
  const [currentIndex, setCurrentIndexState] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  
  // 导航状态
  const [nextArticleId, setNextArticleId] = useState<string | null>(null);
  const [prevArticleId, setPrevArticleId] = useState<string | null>(null);
  const [collection, setCollection] = useState<Collection | null>(null);
  const [tocMode, setTocMode] = useState<'chapters' | 'headings'>('headings');

  // 使用 ref 同步最新状态，避免事件处理器依赖过多
  const stateRef = useRef({
    article: undefined as Article | undefined,
    sentences: [] as string[],
    currentIndex: 0,
    isFinished: false,
    nextArticleId: null as string | null,
  });

  // 同步 ref
  useEffect(() => {
    stateRef.current = {
      article,
      sentences,
      currentIndex,
      isFinished,
      nextArticleId,
    };
  }, [article, sentences, currentIndex, isFinished, nextArticleId]);

  // currentIndex ref 用于进度保存
  const currentIndexRef = useRef(currentIndex);
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);

  // 初始化句子与进度
  useEffect(() => {
    if (!article) return;
    
    const s = article.type === 'markdown'
      ? splitMarkdownBlocks(article.content || "")
      : splitSentences(article.content || "");
    
    setSentences(s);
    
    // 恢复阅读位置
    const resumeIndex = article.lastReadSentence && article.lastReadSentence < s.length
      ? article.lastReadSentence
      : 0;
    setCurrentIndexState(resumeIndex);
  }, [article?.id, article?.content, article?.type]); // 精确依赖

  // 导航数据
  const { data: nav } = useArticleNavigation(article?.id);
  useEffect(() => {
    if (!nav) return;
    
    if (nav.collection) {
      setCollection(nav.collection);
      setTocMode('chapters');
    }
    setPrevArticleId(nav.prev?.id ?? null);
    setNextArticleId(nav.next?.id ?? null);
  }, [nav]);

  // 错误处理
  useEffect(() => {
    if (articleError && !isLoadingArticle) {
      console.error('Failed to load article:', articleError);
      router.replace("/");
    }
  }, [articleError, isLoadingArticle, router]);

  // 冷却系统
  const { progress: cooldownProgress, isActive: isCooldown, shake, check: checkCooldown } = 
    useCooldown(sentences, currentIndex, article?.type);

  // 进度保存系统
  const { scheduleSave, saveImmediately } = useProgressSaver(
    article, 
    currentIndexRef, 
    sentences.length
  );

  // 索引变化时调度保存
  useEffect(() => {
    if (!article || sentences.length === 0) return;
    scheduleSave();
  }, [currentIndex, article, sentences.length, scheduleSave]);

  // 安全的索引设置（带保存）
  const setCurrentIndex = useCallback((index: number | ((prev: number) => number)) => {
    setCurrentIndexState(prev => {
      const next = typeof index === 'function' ? index(prev) : index;
      return Math.max(0, Math.min(next, sentences.length - 1));
    });
  }, [sentences.length]);

  // 键盘控制 - 只绑定一次，通过 ref 读取最新状态
  useEffect(() => {
    const RESTRICTED_KEYS = new Set([
      "ArrowUp", "ArrowDown", "ArrowRight",
      "PageUp", "PageDown", "Home", "End",
      "w", "s", "d", "W", "S", "D"
    ]);

    const handleKeyDown = (e: KeyboardEvent) => {
      const { article, sentences, currentIndex, isFinished } = stateRef.current;
      
      // 阻止默认滚动
      if (RESTRICTED_KEYS.has(e.key)) {
        e.preventDefault();
        return;
      }

      // ESC: 保存并退出
      if (e.key === "Escape") {
        e.preventDefault();
        saveImmediately();
        router.replace("/");
        return;
      }

      // 后退: ArrowLeft, Backspace, A
      if (e.key === "ArrowLeft" || e.key === "Backspace" || e.key === "a" || e.key === "A") {
        e.preventDefault();
        if (currentIndex > 0) {
          setCurrentIndexState(currentIndex - 1);
        }
        return;
      }

      // 前进: Space
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        
        if (!checkCooldown()) return;

        if (currentIndex < sentences.length - 1) {
          setCurrentIndexState(currentIndex + 1);
        } else if (!isFinished && article) {
          saveImmediately(true);
          setIsFinished(true);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, { passive: false });
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router, checkCooldown, saveImmediately]); // 最小依赖

  // 触摸滑动控制 - 移动端手势支持
  useEffect(() => {
    const containerRef = { current: document.body };
    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;
    const MIN_SWIPE_DISTANCE = 50;
    const MAX_VERTICAL_DISTANCE = 100; // 排除垂直滑动的干扰

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.changedTouches[0].screenX;
      touchStartY = e.changedTouches[0].screenY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      touchEndX = e.changedTouches[0].screenX;
      touchEndY = e.changedTouches[0].screenY;
      
      const deltaX = touchEndX - touchStartX;
      const deltaY = Math.abs(touchEndY - touchStartY);
      
      // 忽略垂直滑动
      if (deltaY > MAX_VERTICAL_DISTANCE) return;
      
      const { sentences, currentIndex, isFinished, article } = stateRef.current;
      
      // 右滑（手指从左向右）- 后退
      if (deltaX > MIN_SWIPE_DISTANCE) {
        if (currentIndex > 0) {
          setCurrentIndexState(currentIndex - 1);
        }
      }
      
      // 左滑（手指从右向左）- 前进
      if (deltaX < -MIN_SWIPE_DISTANCE) {
        if (!checkCooldown()) return;
        
        if (currentIndex < sentences.length - 1) {
          setCurrentIndexState(currentIndex + 1);
        } else if (!isFinished && article) {
          saveImmediately(true);
          setIsFinished(true);
        }
      }
    };

    // 双击处理 - 双击返回顶部或底部
    let lastTap = 0;
    const handleDoubleTap = (e: TouchEvent) => {
      const currentTime = new Date().getTime();
      const tapLength = currentTime - lastTap;
      
      if (tapLength < 300 && tapLength > 0) {
        // 双击
        const { sentences } = stateRef.current;
        const touchY = e.changedTouches[0].screenY;
        const screenHeight = window.innerHeight;
        
        // 点击屏幕上半部分返回顶部，下半部分跳到底部
        if (touchY < screenHeight / 2) {
          setCurrentIndexState(0);
        } else {
          setCurrentIndexState(sentences.length - 1);
        }
        
        e.preventDefault();
      }
      lastTap = currentTime;
    };

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });
    document.addEventListener("touchend", handleDoubleTap, { passive: false });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchend", handleTouchEnd);
      document.removeEventListener("touchend", handleDoubleTap);
    };
  }, [checkCooldown, saveImmediately]);

  // TOC 解析 - 依赖 content 而非 sentences 数组引用
  const tocItems = useMemo(() => {
    if (article?.type !== "markdown" || !article.content) return [];

    const items: { index: number; depth: number; text: string }[] = [];
    const blocks = splitMarkdownBlocks(article.content);
    
    for (let i = 0; i < blocks.length; i++) {
      const lines = blocks[i].split("\n");
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
        
        const depth = match[1].length;
        const text = match[2].trim();
        if (text) items.push({ index: i, depth, text });
      }
    }
    return items;
  }, [article?.id, article?.content, article?.type]);

  return {
    article,
    sentences,
    currentIndex,
    setCurrentIndex,
    isFinished,
    nextArticleId,
    setIsFinished,
    prevArticleId,
    collection,
    tocMode,
    isCooldown,
    cooldownProgress,
    shake,
    tocItems,
    isLoadingArticle,
    localId
  };
}
