import { useState, useCallback } from "react";
import { ConceptData } from "@/lib/store/useConceptStore";
import { useAddConcept } from "@/lib/hooks/use-concepts";

interface ActiveCardState {
  x: number;
  y: number;
  term: string;
  savedData?: ConceptData;
}

interface UseActiveCardOptions {
  articleId?: string;
  concepts: Record<string, ConceptData>;
}

export function useActiveCard({ articleId, concepts }: UseActiveCardOptions) {
  const [activeCard, setActiveCard] = useState<ActiveCardState | null>(null);
  const addConceptMutation = useAddConcept();

  const openCard = useCallback((x: number, y: number, term: string) => {
    const savedData = concepts[term];
    setActiveCard({ x, y, term, savedData });
  }, [concepts]);

  const openCardFromEvent = useCallback((e: React.MouseEvent, term: string) => {
    const savedData = concepts[term];
    if (!savedData) return;

    const target = e.target as HTMLElement;
    if (target && typeof target.getBoundingClientRect === 'function') {
      const rect = target.getBoundingClientRect();
      setActiveCard({ x: rect.left, y: rect.top, term, savedData });
    } else {
      // 降级方案：使用屏幕中心
      setActiveCard({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
        term,
        savedData
      });
    }
  }, [concepts]);

  const openCardFromRect = useCallback((rect: DOMRect, term: string) => {
    const savedData = concepts[term];
    setActiveCard({ x: rect.left, y: rect.top, term, savedData });
  }, [concepts]);

  const openCardCentered = useCallback((term: string) => {
    const savedData = concepts[term];
    if (!savedData) return;

    setActiveCard({
      x: window.innerWidth / 2 - 140,
      y: window.innerHeight / 2 - 100,
      term,
      savedData
    });
  }, [concepts]);

  const closeCard = useCallback(() => {
    setActiveCard(null);
  }, []);

  const saveCard = useCallback(async (data: ConceptData) => {
    if (!articleId) return;

    try {
      await addConceptMutation.mutateAsync({
        ...data,
        sourceArticleId: articleId
      });
      setActiveCard(null);
    } catch (error) {
      console.error('Failed to save concept:', error);
      throw error;
    }
  }, [articleId, addConceptMutation]);

  return {
    activeCard,
    openCard,
    openCardFromEvent,
    openCardFromRect,
    openCardCentered,
    closeCard,
    saveCard,
    isOpen: !!activeCard
  };
}

