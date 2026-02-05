import { useState } from "react";
import { ImageIcon, Eye, EyeOff } from "lucide-react";

interface MarkdownImageProps {
  src?: string;
  alt?: string;
}

export function MarkdownImage({ src, alt }: MarkdownImageProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-full my-4 p-4 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center gap-3 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800/80 transition-colors group"
      >
        <ImageIcon className="w-4 h-4" />
        <span className="text-xs font-mono">图片: {alt || "已隐藏"}</span>
        <span className="text-xs text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors ml-auto flex items-center gap-1">
          <Eye className="w-3 h-3" /> 显示
        </span>
      </button>
    );
  }

  return (
    <div className="relative group">
      <span
        className="block relative w-full my-4 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900"
        style={{ aspectRatio: "16 / 9", minHeight: 180 }}
      >
        {!loaded && !error && (
          <span className="block absolute inset-0 animate-pulse bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900" />
        )}
        {!error && src ? (
          <img
            key={retryKey}
            src={src}
            alt={alt}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
            className="absolute inset-0 w-full h-full object-contain"
            onLoad={() => setLoaded(true)}
            onError={() => setError(true)}
          />
        ) : null}
        {error && (
          <span className="absolute inset-0 flex items-center justify-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
            <span>图片加载失败</span>
            <button
              onClick={() => {
                setError(false);
                setLoaded(false);
                setRetryKey((k) => k + 1);
              }}
              className="px-2 py-1 rounded bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black"
            >
              重试
            </button>
            {src && (
              <a
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700"
              >
                在新标签打开
              </a>
            )}
          </span>
        )}
      </span>
      <button
        onClick={() => setIsOpen(false)}
        className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
        title="隐藏图片"
      >
        <EyeOff className="w-3 h-3" />
      </button>
    </div>
  );
}
