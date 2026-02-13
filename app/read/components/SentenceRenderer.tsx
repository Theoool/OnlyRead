import { memo, useContext, forwardRef } from "react";
import { motion } from "framer-motion";
import { twMerge } from "tailwind-merge";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import { useMarkdownComponents } from "./useMarkdownComponents";
import { HighlightContext } from "./ReaderView";

interface SentenceRendererProps {
  sentence: string;
  index: number;
  currentIndex: number;
  articleType: 'markdown' | 'text';
  isCurrent: boolean;
  isVisible: boolean;
  shake: number;
  isCooldown: boolean;
  cooldownProgress: number;
}

export const SentenceRenderer = memo(forwardRef<HTMLDivElement, SentenceRendererProps>(({
  sentence,
  index,
  currentIndex,
  articleType,
  isCurrent,
  isVisible,
  shake,
  isCooldown,
  cooldownProgress
}, ref) => {
  const highlightContext = useContext(HighlightContext);
  
  if (!isVisible) return null;

  // 获取 Markdown 组件配置
  const markdownComponents = useMarkdownComponents({
    visibleCards: highlightContext?.visibleCards || new Set(),
    onTermClick: highlightContext?.onTermClick || (() => {}),
    terms: highlightContext?.terms || []
  });

  return (
    <motion.div
      ref={ref}
      key={index}
      initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
      animate={{
        opacity: isCurrent ? 1 : 0.2,
        y: isCurrent ? 0 : -30,
        filter: isCurrent ? "blur(0px)" : "blur(1px)",
        scale: isCurrent ? 1.02 : 1,
        x: isCurrent && shake % 2 !== 0 ? [0, -4, 4, -4, 4, 0] : 0,
      }}
      transition={{
        duration: 0.4,
        ease: "easeOut",
      }}
      className={twMerge(
        "relative group transition-all duration-500 ease-out my-6 md:my-8 scroll-mt-20 md:scroll-mt-24",
        "will-change-transform",
        articleType === "markdown" ? "w-full" : ""
      )}
    >
      {articleType === "markdown" ? (
        <div
          className={twMerge(
            "text-base sm:text-[15px] md:text-lg leading-normal sm:leading-[1.7] md:leading-relaxed text-zinc-800 dark:text-zinc-200 transition-colors duration-300 font-serif",
            isCurrent ? "opacity-100" : "opacity-50"
          )}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight]}
            components={markdownComponents}
          >
            {sentence}
          </ReactMarkdown>
        </div>
      ) : (
        <p
          className={twMerge(
            "text-lg sm:text-xl md:text-3xl leading-[1.6] sm:leading-[1.7] md:leading-relaxed font-serif tracking-wide transition-colors duration-300",
            isCurrent ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-300 dark:text-zinc-700"
          )}
        >
          {sentence}
        </p>
      )}

   
      {isCurrent && (
        <>
          {/* 桌面端：左侧进度条 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: isCooldown ? 1 : 0 }}
            className="hidden md:block absolute -left-4 top-1/2 -translate-y-1/2 w-1 h-full max-h-[1.5em] rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden"
          >
            <motion.div
              className="w-full bg-zinc-900 dark:bg-zinc-100 bottom-0 absolute"
              style={{ height: `${cooldownProgress}%` }}
            />
          </motion.div>
          
          {/* 移动端：底部进度条 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: isCooldown ? 0.6 : 0 }}
            className="md:hidden absolute -bottom-3 left-0 right-0 h-1 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden"
          >
            <motion.div
              className="h-full bg-zinc-900 dark:bg-zinc-100"
              style={{ width: `${cooldownProgress}%` }}
              transition={{ duration: 0.1 }}
            />
          </motion.div>
        </>
      )}
    </motion.div>
  );
}));

SentenceRenderer.displayName = 'SentenceRenderer';
