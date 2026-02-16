import React, { useMemo, useCallback, type ReactNode, type ComponentPropsWithoutRef, JSX } from 'react';
import type { Components } from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

// ============================================
// 类型定义
// ============================================

interface TermData {
  id: string;
  term: string;
  [key: string]: unknown;
}

interface HighlightOptions {
  visibleCards: Set<string>;
  onTermClick: (termId: string) => void;
  className?: string;
}

type MarkdownComponentProps<T extends keyof JSX.IntrinsicElements> = 
  ComponentPropsWithoutRef<T> & {
    children?: ReactNode;
  };

// ============================================
// 高亮工具函数（优化版）
// ============================================

const escapeRegExp = (string: string): string => 
  string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const HighlightedText: React.FC<{
  text: string;
  terms: TermData[];
  onTermClick: (termId: string) => void;
  visibleCards: Set<string>;
}> = React.memo(({ text, terms, onTermClick, visibleCards }) => {
  if (!terms.length) return <>{text}</>;

  // 按长度降序排序，避免短词匹配干扰长词
  const sortedTerms = [...terms].sort((a, b) => b.term.length - a.term.length);
  const pattern = new RegExp(
    `(${sortedTerms.map(t => escapeRegExp(t.term)).join('|')})`,
    'gi'
  );

  const parts = text.split(pattern);
  
  return (
    <>
      {parts.map((part, index) => {
        const matchedTerm = sortedTerms.find(
          t => t.term.toLowerCase() === part.toLowerCase()
        );
        
        if (!matchedTerm) return <React.Fragment key={index}>{part}</React.Fragment>;
        
        const isVisible = visibleCards.has(matchedTerm.id);
        
        return (
          <mark
            key={`${matchedTerm.id}-${index}`}
            onClick={() => onTermClick(matchedTerm.id)}
            className={`
              cursor-pointer rounded px-1 transition-all duration-200
              ${isVisible 
                ? 'bg-blue-500/20 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/50' 
                : 'bg-yellow-200/50 dark:bg-yellow-900/30 text-inherit hover:bg-yellow-300/50 dark:hover:bg-yellow-900/50'
              }
            `}
          >
            {part}
          </mark>
        );
      })}
    </>
  );
});

// 递归处理 React 节点的高亮
const highlightChildren = (
  children: ReactNode,
  terms: TermData[],
  visibleCards: Set<string>,
  onTermClick: (termId: string) => void
): ReactNode => {
  if (typeof children === 'string') {
    return (
      <HighlightedText 
        text={children} 
        terms={terms}
        visibleCards={visibleCards}
        onTermClick={onTermClick}
      />
    );
  }

  if (Array.isArray(children)) {
    return children.map((child, index) => (
      <React.Fragment key={index}>
        {highlightChildren(child, terms, visibleCards, onTermClick)}
      </React.Fragment>
    ));
  }

  if (React.isValidElement(children)) {
    const childProps = children.props as { children?: ReactNode; [key: string]: unknown };
    const { children: nestedChildren, ...props } = childProps;
    return React.cloneElement(
      children,
      props,
      highlightChildren(nestedChildren, terms, visibleCards, onTermClick)
    );
  }

  return children;
};

// ============================================
// 组件工厂（性能优化版）
// ============================================

interface CreateMarkdownComponentsOptions {
  visibleCards: Set<string>;
  onTermClick: (termId: string) => void;
  terms?: TermData[];
  enableSyntaxHighlight?: boolean;
}

export const useMarkdownComponents = ({
  visibleCards,
  onTermClick,
  terms = [],
  enableSyntaxHighlight = true,
}: CreateMarkdownComponentsOptions): Components => {
  
  // 缓存高亮函数，避免重复创建
  const highlight = useCallback(
    (children: ReactNode) => highlightChildren(children, terms, visibleCards, onTermClick),
    [terms, visibleCards, onTermClick]
  );

  return useMemo(() => {
    // 通用容器样式
    const baseHeadingClass = "font-bold text-zinc-900 dark:text-zinc-50 font-sans scroll-mt-20";
    const baseTextClass = "text-zinc-600 dark:text-zinc-300";

    const components: Components = {
      // 标题层级
      h1: ({ children, id }: MarkdownComponentProps<'h1'>) => (
        <h1 
          id={id}
          className={`${baseHeadingClass} text-3xl sm:text-4xl mt-10 mb-6 leading-tight`}
        >
          {highlight(children)}
          {id && (
            <a 
              href={`#${id}`} 
              className="ml-2 text-zinc-400 dark:text-zinc-600 opacity-0 hover:opacity-100 transition-opacity text-lg"
              aria-label="链接到此标题"
            >
              #
            </a>
          )}
        </h1>
      ),
      
      h2: ({ children, id }: MarkdownComponentProps<'h2'>) => (
        <h2 
          id={id}
          className={`${baseHeadingClass} text-2xl sm:text-3xl mt-8 mb-4 pb-2 border-b border-zinc-200 dark:border-zinc-800`}
        >
          {highlight(children)}
        </h2>
      ),
      
      h3: ({ children, id }: MarkdownComponentProps<'h3'>) => (
        <h3 
          id={id}
          className={`${baseHeadingClass} text-xl sm:text-2xl mt-6 mb-3`}
        >
          {highlight(children)}
        </h3>
      ),
      
      h4: ({ children, id }: MarkdownComponentProps<'h4'>) => (
        <h4 
          id={id}
          className={`${baseHeadingClass} text-lg sm:text-xl mt-5 mb-2`}
        >
          {highlight(children)}
        </h4>
      ),

      h5: ({ children }: MarkdownComponentProps<'h5'>) => (
        <h5 className={`${baseHeadingClass} text-base sm:text-lg mt-4 mb-2`}>
          {highlight(children)}
        </h5>
      ),

      h6: ({ children }: MarkdownComponentProps<'h6'>) => (
        <h6 className={`${baseHeadingClass} text-sm sm:text-base mt-4 mb-2 uppercase tracking-wide`}>
          {highlight(children)}
        </h6>
      ),

      // 段落与文本
      p: ({ children }: MarkdownComponentProps<'p'>) => (
        <p className={`mb-5 leading-7 ${baseTextClass}`}>
          {highlight(children)}
        </p>
      ),

      // 列表系统
      ul: ({ children }: MarkdownComponentProps<'ul'>) => (
        <ul className="list-disc list-outside mb-5 pl-6 space-y-2 marker:text-zinc-400 dark:marker:text-zinc-600">
          {children}
        </ul>
      ),

      ol: ({ children }: MarkdownComponentProps<'ol'>) => (
        <ol className="list-decimal list-outside mb-5 pl-6 space-y-2 marker:text-zinc-500 dark:marker:text-zinc-500">
          {children}
        </ol>
      ),

      li: ({ children }: MarkdownComponentProps<'li'>) => (
        <li className={`leading-7 ${baseTextClass}`}>
          {highlight(children)}
        </li>
      ),

      // 任务列表支持
      input: ({ type, checked, ...props }: MarkdownComponentProps<'input'>) => {
        if (type === 'checkbox') {
          return (
            <input
              type="checkbox"
              checked={checked}
              readOnly
              className="mr-2 mt-1 accent-blue-600 w-4 h-4 cursor-default"
              {...props}
            />
          );
        }
        return <input type={type} {...props} />;
      },

      // 引用块
      blockquote: ({ children }: MarkdownComponentProps<'blockquote'>) => (
        <blockquote className="border-l-4 border-blue-500 dark:border-blue-600 pl-5 py-1 my-6 italic bg-zinc-50 dark:bg-zinc-900/50 rounded-r-lg">
          <div className={`${baseTextClass} not-italic`}>
            {highlight(children)}
          </div>
        </blockquote>
      ),

      // 文本样式
      strong: ({ children }: MarkdownComponentProps<'strong'>) => (
        <strong className="font-semibold text-zinc-900 dark:text-zinc-100">
          {highlight(children)}
        </strong>
      ),

      em: ({ children }: MarkdownComponentProps<'em'>) => (
        <em className="italic text-zinc-800 dark:text-zinc-200">
          {highlight(children)}
        </em>
      ),

      del: ({ children }: MarkdownComponentProps<'del'>) => (
        <del className="line-through text-zinc-400 dark:text-zinc-600 decoration-zinc-400">
          {highlight(children)}
        </del>
      ),

      // 代码系统（语法高亮）
      pre: ({ children }: MarkdownComponentProps<'pre'>) => {
        // 提取 code 元素的 props
        const codeElement = React.Children.toArray(children)[0] as React.ReactElement;
        if (!codeElement?.props) return <pre>{children}</pre>;

        const codeProps = codeElement.props as { className?: string; children?: ReactNode };
        const { className, children: codeContent } = codeProps;
        const match = /language-(\w+)/.exec(className || '');
        const language = match?.[1] || 'text';

        if (!enableSyntaxHighlight || !match) {
          return (
            <div className="my-6 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-900">
              <pre className="p-4 overflow-x-auto text-sm text-zinc-100 font-mono leading-relaxed">
                {codeContent}
              </pre>
            </div>
          );
        }

        return (
          <div className="my-6 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-lg group">
            <div className="bg-zinc-800 px-4 py-2 flex items-center justify-between border-b border-zinc-700">
              <span className="text-xs text-zinc-400 font-mono uppercase">{language}</span>
              <button
                onClick={() => navigator.clipboard.writeText(String(codeContent))}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                aria-label="复制代码"
              >
                复制
              </button>
            </div>
            <SyntaxHighlighter
              language={language}
              style={vscDarkPlus}
              customStyle={{
                margin: 0,
                padding: '1.5rem',
                fontSize: '0.875rem',
                lineHeight: '1.7',
                background: '#0d1117',
              }}
              showLineNumbers
              lineNumberStyle={{ color: '#484f58', minWidth: '3em' }}
            >
              {String(codeContent).replace(/\n$/, '')}
            </SyntaxHighlighter>
          </div>
        );
      },

      code: ({ className, children, ...props }: MarkdownComponentProps<'code'>) => {
        const isInline = !className?.includes('language-');
        
        if (isInline) {
          return (
            <code
              className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-md text-sm font-mono text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700"
              {...props}
            >
              {children}
            </code>
          );
        }
        
        // 块级代码由 pre 组件处理，这里直接透传
        return (
          <code className={className} {...props}>
            {children}
          </code>
        );
      },

      // 链接（可访问性优化）
      a: ({ href, children, ...props }: MarkdownComponentProps<'a'>) => {
        const isExternal = href?.startsWith('http');
        
        return (
          <a
            href={href}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline decoration-blue-300 dark:decoration-blue-700 underline-offset-2 transition-colors font-medium"
            {...(isExternal && {
              target: '_blank',
              rel: 'noopener noreferrer',
            })}
            {...props}
          >
            {highlight(children)}
            {isExternal && (
              <span className="inline-block ml-0.5 text-xs" aria-hidden="true">↗</span>
            )}
          </a>
        );
      },

      // 图片（懒加载 + 错误处理）
      img: ({ src, alt, ...props }: MarkdownComponentProps<'img'>) => (
        <figure className="my-8">
          <div className="rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900">
            <img
              src={src}
              alt={alt || ''}
              loading="lazy"
              className="w-full h-auto object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24"%3E%3Cpath fill="%23999" d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/%3E%3C/svg%3E';
              }}
              {...props}
            />
          </div>
          {alt && (
            <figcaption className="mt-2 text-center text-sm text-zinc-500 dark:text-zinc-400 italic">
              {highlight(alt)}
            </figcaption>
          )}
        </figure>
      ),

      // 表格系统
      table: ({ children }: MarkdownComponentProps<'table'>) => (
        <div className="overflow-x-auto my-6 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <table className="min-w-full text-left text-sm border-collapse">
            {children}
          </table>
        </div>
      ),

      thead: ({ children }: MarkdownComponentProps<'thead'>) => (
        <thead className="bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
          {children}
        </thead>
      ),

      tbody: ({ children }: MarkdownComponentProps<'tbody'>) => (
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
          {children}
        </tbody>
      ),

      tr: ({ children }: MarkdownComponentProps<'tr'>) => (
        <tr className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
          {children}
        </tr>
      ),

      th: ({ children }: MarkdownComponentProps<'th'>) => (
        <th className="p-4 font-semibold text-zinc-900 dark:text-zinc-100">
          {highlight(children)}
        </th>
      ),

      td: ({ children }: MarkdownComponentProps<'td'>) => (
        <td className={`p-4 ${baseTextClass}`}>
          {highlight(children)}
        </td>
      ),

      // 分隔线与换行
      hr: () => (
        <hr className="my-8 border-t border-zinc-200 dark:border-zinc-800" />
      ),

      br: () => <br />,

      // HTML 细节组件（可折叠内容）
      details: ({ children }: MarkdownComponentProps<'details'>) => (
        <details className="my-4 p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 group">
          {children}
        </details>
      ),

      summary: ({ children }: MarkdownComponentProps<'summary'>) => (
        <summary className="font-semibold cursor-pointer list-none flex items-center justify-between text-zinc-900 dark:text-zinc-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
          <span>{highlight(children)}</span>
          <span className="transform group-open:rotate-180 transition-transform">▼</span>
        </summary>
      ),
    };

    return components;
  }, [highlight, enableSyntaxHighlight]);
};
