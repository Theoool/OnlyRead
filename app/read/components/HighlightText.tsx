import { memo, useMemo } from "react";
import { ConceptData } from "@/lib/store/useConceptStore";

interface HighlightTextProps {
  text: string;
  cards: ConceptData[];
  onTermClick: (e: React.MouseEvent, term: string) => void;
}

/**
 * 将正则特殊字符转义
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 查找匹配的 concept term
 * 支持大小写不敏感匹配，优先返回精确匹配
 */
function findMatchingTerm(text: string, cards: ConceptData[]): string | null {
  // 首先尝试精确匹配（区分大小写）
  const exactMatch = cards.find((c) => c.term === text);
  if (exactMatch) return exactMatch.term;

  // 尝试不区分大小写匹配
  const lowerText = text.toLowerCase();
  const caseInsensitiveMatch = cards.find(
    (c) => c.term.toLowerCase() === lowerText
  );
  if (caseInsensitiveMatch) return caseInsensitiveMatch.term;

  return null;
}

export const HighlightText = memo(function HighlightText({
  text,
  cards,
  onTermClick,
}: HighlightTextProps) {
  if (!cards?.length || !text) return <>{text}</>;

  // 构建匹配模式：按长度降序排序，优先匹配长词（避免短词提前匹配）
  const sortedCards = useMemo(
    () => [...cards].sort((a, b) => b.term.length - a.term.length),
    [cards]
  );

  const terms = useMemo(
    () =>
      sortedCards
        .map((c) => c.term?.trim())
        .filter(Boolean)
        .filter((term, index, self) => self.indexOf(term) === index), // 去重
    [sortedCards]
  );

  const pattern = useMemo(() => {
    if (terms.length === 0) return null;
    // 使用不区分大小写的匹配
    return new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gi");
  }, [terms]);

  if (!pattern) return <>{text}</>;

  // 分割文本
  const parts = text.split(pattern);

  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null;

        // 查找匹配的 term（处理大小写）
        const matchedTerm = findMatchingTerm(part, cards);

        if (matchedTerm) {
          return (
            <span
              key={`${i}-${part}`}
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onTermClick(e, matchedTerm);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onTermClick(e as any, matchedTerm);
                }
              }}
              className="
                inline decoration-clone
                border-b-2 border-purple-400/50
                bg-purple-100/50 dark:bg-purple-900/30
                cursor-pointer
                rounded-sm px-0.5 mx-0.5
                hover:bg-purple-200 dark:hover:bg-purple-800/60
                focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none
                transition-colors duration-200
                font-medium text-purple-900 dark:text-purple-100
              "
            >
              {part}
            </span>
          );
        }
        return <span key={`${i}-${part}`}>{part}</span>;
      })}
    </>
  );
});
