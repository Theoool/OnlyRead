import { useRef, useEffect, useMemo, createContext } from "react";
import { ConceptData } from "@/lib/store/useConceptStore";
import { SentenceRenderer } from "./SentenceRenderer";
import { useCenteredScroll } from "../hooks/useScrollOptimization";

// 创建高亮上下文
interface HighlightContextType {
  visibleCards: Set<string>;
  onTermClick: (termId: string) => void;
  terms: Array<{ id: string; term: string }>;
}

export const HighlightContext = createContext<HighlightContextType | null>(null);

interface ReaderViewProps {
  sentences: string[];
  currentIndex: number;
  articleType: 'markdown' | 'text';
  visibleCards: ConceptData[];
  onTermClick: (e: React.MouseEvent, term: string) => void;
  isCooldown: boolean;
  cooldownProgress: number;
  shake: number;
}

export function ReaderView({
  sentences,
  currentIndex,
  articleType,
  visibleCards,
  onTermClick,
  isCooldown,
  cooldownProgress,
  shake,
}: ReaderViewProps) {
  const currentSentenceRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollToCenter } = useCenteredScroll();

 

  // 创建高亮上下文值
  const highlightContextValue = useMemo(() => ({
    visibleCards: new Set(visibleCards.map(c => c.id || c.term)),
    onTermClick: (termId: string) => {
      const card = visibleCards.find(c => (c.id || c.term) === termId);
      if (card) {
        // 创建一个模拟的 MouseEvent 对象，包含必要的 target 属性
        const mockEvent = {
          target: {
            getBoundingClientRect: () => ({
              left: window.innerWidth / 2,
              top: window.innerHeight / 2,
              width: 0,
              height: 0,
              bottom: window.innerHeight / 2,
              right: window.innerWidth / 2,
              x: window.innerWidth / 2,
              y: window.innerHeight / 2,
              toJSON: () => ({})
            })
          }
        } as unknown as React.MouseEvent;
        onTermClick(mockEvent, card.term);
      }
    },
    terms: visibleCards.map(c => ({ 
      id: c.id || c.term, 
      term: c.term 
    }))
  }), [visibleCards, onTermClick]);

  // 优化的滚动定位逻辑
  useEffect(() => {
    if (currentSentenceRef.current && currentIndex < sentences.length) {
      scrollToCenter(currentSentenceRef.current, {
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [currentIndex, sentences.length, scrollToCenter]);

  // 动态渲染窗口 - 根据设备类型调整
  const getWindowSize = () => {
    const isMobile = window.innerWidth < 768;
    return isMobile ? 15 : 30;
  };

  const windowSize = getWindowSize();
  const renderStartIndex = Math.max(0, currentIndex - Math.floor(windowSize / 2));
  const renderEndIndex = Math.min(sentences.length, currentIndex + Math.floor(windowSize / 2));



  return (
    <HighlightContext.Provider value={highlightContextValue}>
      <main
        ref={containerRef}
        className="flex-1 relative overflow-y-auto flex flex-col items-center z-10 scroll-smooth no-scrollbar"
      >
        {/* 响应式容器：移动端更窄，确保良好阅读体验 */}
        <div className="w-full max-w-2xl sm:max-w-3xl px-4 sm:px-6 md:px-8 py-[15vh] sm:py-[25vh] md:py-[40vh] flex flex-col gap-6 sm:gap-8 md:gap-10">
          {sentences.map((sentence, index) => {
            if (index < renderStartIndex || index > renderEndIndex) {
              return null;
            }

            const isVisible = index <= currentIndex;
            const isCurrent = index === currentIndex;

            if (!isVisible) return null;

            return (
              <SentenceRenderer
                key={index}
                ref={isCurrent ? currentSentenceRef : null}
                sentence={sentence}
                index={index}
                currentIndex={currentIndex}
                articleType={articleType}
                isCurrent={isCurrent}
                isVisible={isVisible}
                shake={shake}
                isCooldown={isCooldown}
                cooldownProgress={cooldownProgress}
              />
            );
          })}
        </div>
      </main>
    </HighlightContext.Provider>
  );
}
