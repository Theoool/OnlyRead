import { useRef, useEffect, Children, isValidElement, cloneElement, ReactNode } from "react";
import { motion } from "framer-motion";
import { twMerge } from "tailwind-merge";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import { ConceptData } from "@/lib/store/useConceptStore";
import { HighlightText } from "./HighlightText";
import { MarkdownImage } from "./MarkdownImage";

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

/**
 * 递归处理 React children，对所有字符串节点应用高亮
 * 同时保留原有的 React 元素结构
 */
function highlightChildren(
  children: ReactNode,
  visibleCards: ConceptData[],
  onTermClick: (e: React.MouseEvent, term: string) => void,
  depth: number = 0
): ReactNode {
  // 防止无限递归
  if (depth > 10) return children;

  // 处理字符串
  if (typeof children === 'string') {
    return (
      <HighlightText
        text={children}
        cards={visibleCards}
        onTermClick={onTermClick}
      />
    );
  }

  // 处理数字
  if (typeof children === 'number') {
    return (
      <HighlightText
        text={String(children)}
        cards={visibleCards}
        onTermClick={onTermClick}
      />
    );
  }

  // 处理数组
  if (Array.isArray(children)) {
    return children.map((child, index) => (
      <span key={index}>
        {highlightChildren(child, visibleCards, onTermClick, depth + 1)}
      </span>
    ));
  }

  // 处理 React 元素
  if (isValidElement(children)) {
    const { props } = children as React.ReactElement<any>;
    if (props && props.children) {
      // 递归处理子元素
      const highlightedChildren = highlightChildren(
        props.children,
        visibleCards,
        onTermClick,
        depth + 1
      );
      return cloneElement(children, {
        ...props,
        children: highlightedChildren,
      });
    }
  }

  return children;
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

  // Auto scroll logic
  useEffect(() => {
    if (currentSentenceRef.current) {
      const el = currentSentenceRef.current;
      const rect = el.getBoundingClientRect();
      const isLargeBlock = rect.height > window.innerHeight * 0.5;

      requestAnimationFrame(() => {
        el.scrollIntoView({
          behavior: "smooth",
          block: isLargeBlock ? "start" : "center",
        });
      });
    }
  }, [currentIndex]);

  // Optimization: Windowed Rendering - 扩大渲染窗口以确保 concept 高亮正常工作
  const RENDER_WINDOW = 100; // 增加渲染窗口
  const renderStartIndex = Math.max(0, currentIndex - 50); // 前方多渲染一些
  const renderEndIndex = Math.min(sentences.length, currentIndex + 50); // 后方也多渲染一些

  // 创建高亮 ReactMarkdown 组件配置
  const createMarkdownComponents = () => {
    const commonProps = {
      visibleCards,
      onTermClick,
    };

    return {
      h1: ({ children }: { children?: ReactNode }) => (
        <h1 className="text-3xl font-bold mt-8 mb-4 text-zinc-900 dark:text-zinc-50 font-sans">
          {highlightChildren(children, visibleCards, onTermClick)}
        </h1>
      ),
      h2: ({ children }: { children?: ReactNode }) => (
        <h2 className="text-2xl font-bold mt-6 mb-3 text-zinc-900 dark:text-zinc-50 font-sans">
          {highlightChildren(children, visibleCards, onTermClick)}
        </h2>
      ),
      h3: ({ children }: { children?: ReactNode }) => (
        <h3 className="text-xl font-bold mt-4 mb-2 text-zinc-900 dark:text-zinc-50 font-sans">
          {highlightChildren(children, visibleCards, onTermClick)}
        </h3>
      ),
      h4: ({ children }: { children?: ReactNode }) => (
        <h4 className="text-lg font-bold mt-3 mb-2 text-zinc-900 dark:text-zinc-50 font-sans">
          {highlightChildren(children, visibleCards, onTermClick)}
        </h4>
      ),
      p: ({ children }: { children?: ReactNode }) => (
        <p className="mb-4 leading-relaxed">
          {highlightChildren(children, visibleCards, onTermClick)}
        </p>
      ),
      ul: ({ children }: { children?: ReactNode }) => (
        <ul className="list-disc list-inside mb-4 pl-4 space-y-1">
          {children}
        </ul>
      ),
      ol: ({ children }: { children?: ReactNode }) => (
        <ol className="list-decimal list-inside mb-4 pl-4 space-y-1">
          {children}
        </ol>
      ),
      li: ({ children }: { children?: ReactNode }) => (
        <li className="mb-1">{highlightChildren(children, visibleCards, onTermClick)}</li>
      ),
      blockquote: ({ children }: { children?: ReactNode }) => (
        <blockquote className="border-l-4 border-zinc-300 dark:border-zinc-700 pl-4 italic my-4 text-zinc-500 dark:text-zinc-400">
          {highlightChildren(children, visibleCards, onTermClick)}
        </blockquote>
      ),
      strong: ({ children }: { children?: ReactNode }) => (
        <strong className="font-bold text-zinc-900 dark:text-zinc-100">
          {highlightChildren(children, visibleCards, onTermClick)}
        </strong>
      ),
      em: ({ children }: { children?: ReactNode }) => (
        <em className="italic">
          {highlightChildren(children, visibleCards, onTermClick)}
        </em>
      ),
      del: ({ children }: { children?: ReactNode }) => (
        <del className="line-through">
          {highlightChildren(children, visibleCards, onTermClick)}
        </del>
      ),
      pre: ({ children }: { children?: ReactNode }) => (
        <div className="my-6 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-sm font-mono">
          <pre className="bg-[#0d1117] p-4 overflow-x-auto text-sm text-zinc-100">
            {children}
          </pre>
        </div>
      ),
      code: ({ node, className, children, ...props }: any) => {
        const match = /language-(\w+)/.exec(className || "");
        const isInline = !match && !className?.includes("hljs");
        return isInline ? (
          <code
            className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-sm font-mono text-zinc-800 dark:text-zinc-200"
            {...props}
          >
            {children}
          </code>
        ) : (
          <code className={className} {...props}>
            {children}
          </code>
        );
      },
      a: ({ href, children }: { href?: string; children?: ReactNode }) => (
        <span
          className="text-blue-500 hover:underline decoration-blue-500/30 cursor-pointer"
          onClick={() => href && window.open(href, "_blank")}
        >
          {highlightChildren(children, visibleCards, onTermClick)}
        </span>
      ),
      img: (props: any) => (
        <MarkdownImage src={props.src || ""} alt={props.alt || ""} />
      ),
      table: ({ children }: { children?: ReactNode }) => (
        <div className="overflow-x-auto my-6 border border-zinc-200 dark:border-zinc-800 rounded-lg">
          <table className="min-w-full text-left text-sm">
            {children}
          </table>
        </div>
      ),
      thead: ({ children }: { children?: ReactNode }) => (
        <thead className="bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 font-medium">
          {children}
        </thead>
      ),
      tbody: ({ children }: { children?: ReactNode }) => (
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {children}
        </tbody>
      ),
      tr: ({ children }: { children?: ReactNode }) => (
        <tr className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
          {children}
        </tr>
      ),
      th: ({ children }: { children?: ReactNode }) => (
        <th className="p-3 text-zinc-900 dark:text-zinc-100">
          {highlightChildren(children, visibleCards, onTermClick)}
        </th>
      ),
      td: ({ children }: { children?: ReactNode }) => (
        <td className="p-3 text-zinc-600 dark:text-zinc-400">
          {highlightChildren(children, visibleCards, onTermClick)}
        </td>
      ),
    };
  };

  return (
    <main
      ref={containerRef}
      className="flex-1 relative overflow-y-auto flex flex-col items-center z-10 scroll-smooth no-scrollbar"
    >
      <div className="w-full max-w-3xl px-8 py-[40vh] flex flex-col gap-10">
        {sentences.map((sentence, index) => {
          if (index < renderStartIndex || index > renderEndIndex) {
            return null;
          }

          const isVisible = index <= currentIndex;
          const isCurrent = index === currentIndex;

          if (!isVisible) return null;

          return (
            <motion.div
              key={index}
              ref={isCurrent ? currentSentenceRef : null}
              initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
              animate={{
                opacity: isCurrent ? 1 : 0.2,
                y: 0,
                filter: isCurrent ? "blur(0px)" : "blur(1px)",
                scale: isCurrent ? 1.05 : 1,
                x: isCurrent && shake % 2 !== 0 ? [0, -4, 4, -4, 4, 0] : 0,
              }}
              transition={{
                duration: 0.4,
                ease: "easeOut",
              }}
              className={twMerge(
                "relative group transition-all duration-500 ease-out my-8 scroll-mt-24",
                "will-change-transform",
                articleType === "markdown" ? "w-full" : ""
              )}
            >
              {articleType === "markdown" ? (
                <div
                  className={twMerge(
                    "text-lg md:text-xl leading-relaxed text-zinc-800 dark:text-zinc-200 transition-colors duration-300 font-serif",
                    isCurrent ? "opacity-100" : "opacity-50"
                  )}
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeHighlight]}
                    components={createMarkdownComponents()}
                  >
                    {sentence}
                  </ReactMarkdown>
                </div>
              ) : (
                <p
                  className={twMerge(
                    "text-xl md:text-3xl leading-relaxed font-serif tracking-wide transition-colors duration-300",
                    isCurrent
                      ? "text-zinc-900 dark:text-zinc-50"
                      : "text-zinc-300 dark:text-zinc-700"
                  )}
                >
                  <HighlightText
                    text={sentence}
                    cards={visibleCards}
                    onTermClick={onTermClick}
                  />
                </p>
              )}

              {/* Cooldown Indicator for Current Sentence */}
              {isCurrent && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: isCooldown ? 1 : 0 }}
                  className="absolute -left-4 top-1/2 -translate-y-1/2 w-1 h-full max-h-[1.5em] rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden"
                >
                  <motion.div
                    className="w-full bg-zinc-900 dark:bg-zinc-100 bottom-0 absolute"
                    style={{ height: `${cooldownProgress}%` }}
                  />
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>
    </main>
  );
}
