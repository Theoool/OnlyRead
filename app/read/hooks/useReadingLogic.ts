import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useArticle, useUpdateArticleProgress } from "@/lib/hooks";
import { splitMarkdownBlocks, splitSentences } from "@/lib/text-processing";
import { getCollection, Collection } from "@/lib/core/reading/collections.service";
import type { Article } from "@/lib/core/reading/articles.service";

export function useReadingLogic(initialArticle?: Article) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const localId = searchParams.get("localId");

  const { data: article, isLoading: isLoadingArticle, error: articleError } = useArticle(id || "", { initialData: initialArticle });
  const updateProgressMutation = useUpdateArticleProgress();

  const [sentences, setSentences] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  
  // Navigation State
  const [nextArticleId, setNextArticleId] = useState<string | null>(null);
  const [prevArticleId, setPrevArticleId] = useState<string | null>(null);
  const [collection, setCollection] = useState<Collection | null>(null);
  const [tocMode, setTocMode] = useState<'chapters' | 'headings'>('headings');

  // Cooldown State
  const lastNextTime = useRef<number>(0);
  const [isCooldown, setIsCooldown] = useState(false);
  const [shake, setShake] = useState(0);
  const [cooldownProgress, setCooldownProgress] = useState(100);

  // Error Handling
  useEffect(() => {
    if (articleError && !isLoadingArticle) {
      console.error('Failed to load article:', articleError);
      router.replace("/");
    }
  }, [articleError, isLoadingArticle, router]);

  // Initialize Sentences & Progress
  useEffect(() => {
    if (article) {
      const s = article.type === 'markdown'
        ? splitMarkdownBlocks(article.content || "")
        : splitSentences(article.content || "");
      setSentences(s);

      if (article.lastReadSentence && article.lastReadSentence < s.length) {
        setCurrentIndex(article.lastReadSentence);
      } else {
        setCurrentIndex(0);
      }
    }
  }, [article]);

  // Navigation Logic
  useEffect(() => {
    async function fetchNavigation() {
      if (article?.collectionId) {
        try {
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
            const col = await getCollection(article.collectionId!);
            if (col) {
               setCollection(col);
               setTocMode('chapters');
               
               if (col.articles) {
                  const sorted = col.articles.sort((a, b) => (a.order || 0) - (b.order || 0));
                  const idx = sorted.findIndex(a => a.id === article?.id);
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

  // Progress Saving
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
        saveProgress();
      }
    };
  }, [currentIndex, article, sentences.length]);

  // Cooldown Logic
  useEffect(() => {
    setCooldownProgress(0);
    setIsCooldown(true);
    const currentSentence = sentences[currentIndex] || "";
    
    let minReadTime = 200 + (currentSentence.length * 20);
    if (article?.type === 'markdown') {
        minReadTime = Math.min(minReadTime, 3000); 
    }
    
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

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
          const progress = ((currentIndex + 1) / sentences.length) * 100;
          updateProgressMutation.mutate({
            id: article.id,
            progress,
            lastReadSentence: currentIndex,
            lastRead: Date.now(),
          });
        }
        router.replace("/");
        return;
      }

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
        if (article?.type === 'markdown') {
            minReadTime = Math.min(minReadTime, 3000);
        }

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
          if (article && !isFinished) {
            updateProgressMutation.mutate({
              id: article.id,
              progress: 100,
              lastReadSentence: currentIndex,
              lastRead: Date.now(),
            });
          }
          setIsFinished(true);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, { passive: false });
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, sentences.length, router, article, isFinished]);

  // TOC Logic
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

  return {
    article,
    sentences,
    currentIndex,
    setCurrentIndex,
    isFinished,
    nextArticleId,
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
