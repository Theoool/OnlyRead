import { useRef, useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { twMerge } from "tailwind-merge";
import {
  Loader2,
  FileText,
  ArrowRight,
  AlertCircle,
  Clipboard,
  User,
  LogOut,
  GraduationCap,
} from "lucide-react";
import Link from "next/link";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { isUrl } from "@/lib/utils";
import { SearchBar } from "@/app/components/SearchBar";
import { QuickStats } from "./QuickStats";
import { useIsMobile } from "@/lib/hooks/use-device";
import { useImportManager } from "@/lib/hooks/home/useImportManager";
import { ImportProgressDisplay } from "@/app/components/import/import-progress-display";

interface HomeSidebarProps {
  onSuccess?: (mode: 'articles' | 'collections') => void;
}

export function HomeSidebar({ onSuccess }: HomeSidebarProps) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const { isAuthenticated, user, logout, isLoading: isAuthLoading } = useAuthStore();
  const [value, setValue] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { 
    importFile, 
    importFromUrl, 
    importFromText, 
    isLoading,
    error: importError,
    jobId,
  } = useImportManager({ 
    userId: user?.id, 
    onSuccess: (result) => {
      setValue("");
      onSuccess?.(result.mode);
    },
    onLocalReady: (localId) => {
      // 【本地优先】文件存入 IndexedDB 后立即跳转阅读
      router.push(`/read?localId=${localId}`);
    }
  });

  const [error, setError] = useState("");

  const isInputUrl = isUrl(value);

  // Focus input on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      importFile(files[0]);
    }
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      importFile(files[0]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handlePasteClick = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setValue(text);
        textareaRef.current?.focus();
      }
    } catch (err) {
      setError("无法访问剪贴板，请手动粘贴");
    }
  };

  const handleSubmit = async () => {
    const input = value.trim();
    if (!input || isLoading) return;

    if (isUrl(input)) {
      await importFromUrl(input);
    } else {
      await importFromText(input);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <section 
      className={twMerge(
        "w-full md:w-1/2 lg:w-[55%] flex flex-col relative z-10 bg-white dark:bg-black border-b md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-800 transition-colors duration-200",
        isMobile ? "h-full overflow-y-auto p-5" : "p-12",
        isDragging ? "bg-blue-50 dark:bg-blue-900/20 border-blue-500 dark:border-blue-500" : ""
      )}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".md,.txt,.epub,.pdf"
        onChange={onFileSelect}
      />

      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-5 md:mb-6 flex items-center justify-between"
      >
        <h1 className="text-xl md:text-xl font-bold tracking-tight flex items-center gap-2">
          <span className="w-2 h-2 bg-black dark:bg-white rounded-full inline-block"/>
          阅读
        </h1>

        {/* Auth UI */}
        <div className="flex items-center gap-2 md:gap-3">
          {isAuthenticated && user ? (
            <div className="flex items-center gap-2 md:gap-3">
              <div className="flex items-center gap-2 text-sm">
                {user.avatarUrl && (
                  <Image
                    src={user.avatarUrl}
                    alt={user.fullName || user.email || "User"}
                    width={isMobile ? 28 : 24}
                    height={isMobile ? 28 : 24}
                    className={twMerge(
                      "rounded-full",
                      isMobile ? "w-7 h-7" : "w-6 h-6"
                    )}
                    unoptimized
                  />
                )}
                <span className="text-zinc-600 dark:text-zinc-400 hidden md:inline">
                  {user.fullName || user.email?.split('@')[0]}
                </span>
              </div>
              <button
                onClick={async () => {
                  await logout();
                  window.location.href = '/';
                }}
                disabled={isAuthLoading}
                className={twMerge(
                  "hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-all disabled:opacity-50 active:scale-95 touch-manipulation",
                  isMobile ? "p-2.5 min-w-[44px] min-h-[44px]" : "p-2"
                )}
                title="Logout"
              >
                <LogOut className={twMerge(isMobile ? "w-5 h-5" : "w-4 h-4")} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => window.location.href = '/auth'}
              className={twMerge(
                "flex items-center justify-center gap-2 bg-black dark:bg-white text-white dark:text-black rounded-xl hover:opacity-90 active:scale-95 transition-all font-medium touch-manipulation",
                isMobile ? "min-h-[44px] px-5 py-2.5 text-base" : "px-4 py-2 text-sm rounded-lg"
              )}
            >
              <User className={twMerge(isMobile ? "w-5 h-5" : "w-4 h-4")} />
              登录
            </button>
          )}
        </div>
      </motion.header>


      {/* Learning Center Entry */}
      {isAuthenticated && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="mb-5 md:mb-4"
        >
          <Link
            href="/learning"
            className={twMerge(
              "flex items-center gap-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 active:scale-98 transition-all group touch-manipulation",
              isMobile ? "p-4 min-h-[60px]" : "p-3"
            )}
          >
            <div className={twMerge(
              "bg-indigo-500 rounded-xl flex items-center justify-center",
              isMobile ? "w-12 h-12" : "w-10 h-10"
            )}>
              <GraduationCap className={twMerge(isMobile ? "w-6 h-6" : "w-5 h-5", "text-white")} />
            </div>
            <div className="flex-1">
              <div className={twMerge(
                "font-medium text-zinc-900 dark:text-zinc-100",
                isMobile ? "text-base" : "text-sm"
              )}>
                学习中心
              </div>
              <div className={twMerge(
                "text-zinc-500",
                isMobile ? "text-sm" : "text-xs"
              )}>
                AI 导师陪伴你的学习之旅
              </div>
            </div>
            <ArrowRight className={twMerge(
              isMobile ? "w-5 h-5" : "w-4 h-4",
              "text-indigo-500 group-hover:translate-x-1 transition-transform"
            )} />
          </Link>
        </motion.div>
      )}

      {/* Search Bar */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mb-6 md:mb-6"
      >
        <SearchBar />
      </motion.div>

      <div className="flex-1 flex flex-col justify-center relative">
        {isDragging && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/50 dark:bg-black/50 backdrop-blur-sm rounded-xl border-2 border-dashed border-blue-500">
            <div className="text-blue-500 font-mono font-bold animate-pulse">释放文件</div>
          </div>
        )}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="relative group w-full"
        >
          <textarea
            ref={textareaRef}
            className={twMerge(
              "w-full bg-transparent font-mono leading-tight outline-none resize-none placeholder:text-zinc-200 dark:placeholder:text-zinc-800",
              isMobile ? "h-[30vh] text-2xl" : "h-[40vh] text-4xl"
            )}
            placeholder="你想阅读什么？"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            spellCheck={false}
          />
          
          {/* Input Actions */}
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 md:gap-4 flex-wrap">
               {/* Type Indicator */}
               <AnimatePresence>
                {value && (
                  <motion.span
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className={twMerge(
                      "font-mono text-zinc-400 bg-zinc-100 dark:bg-zinc-900 rounded",
                      isMobile ? "text-xs px-2.5 py-1.5" : "text-xs px-2 py-1"
                    )}
                  >
                    {isInputUrl ? "检测到链接" : "纯文本"}
                  </motion.span>
                )}
              </AnimatePresence>
              
              {/* Error Message */}
              <AnimatePresence>
                {(error || importError) && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className={twMerge(
                      "flex items-center gap-2 text-red-500 font-mono bg-red-50 dark:bg-red-900/20 rounded",
                      isMobile ? "text-xs px-2.5 py-1.5" : "text-xs px-2 py-1"
                    )}
                  >
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate max-w-[150px] md:max-w-none">{error || importError}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {!value && (
                <>
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => fileInputRef.current?.click()}
                    className={twMerge(
                      "rounded-xl bg-zinc-100 dark:bg-zinc-900 text-zinc-500 font-mono flex items-center justify-center gap-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 active:scale-95 transition-all touch-manipulation",
                      isMobile ? "min-w-[48px] min-h-[48px] px-4" : "h-8 px-3 text-xs rounded"
                    )}
                  >
                    <FileText className={twMerge(isMobile ? "w-5 h-5" : "w-3 h-3")} />
                    <span className={twMerge(isMobile ? "text-sm" : "hidden")}>文件</span>
                  </motion.button>

                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handlePasteClick}
                    className={twMerge(
                      "rounded-xl bg-zinc-100 dark:bg-zinc-900 text-zinc-500 font-mono flex items-center justify-center gap-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 active:scale-95 transition-all touch-manipulation",
                      isMobile ? "min-w-[48px] min-h-[48px] px-4" : "h-8 px-3 text-xs rounded"
                    )}
                  >
                    <Clipboard className={twMerge(isMobile ? "w-5 h-5" : "w-3 h-3")} />
                    <span className={twMerge(isMobile ? "text-sm" : "hidden")}>粘贴</span>
                  </motion.button>
                </>
              )}
              
              <button
                onClick={handleSubmit}
                disabled={!value || isLoading}
                className={twMerge(
                  "bg-black dark:bg-white text-white dark:text-black disabled:opacity-0 transition-all flex items-center justify-center gap-2 group active:scale-95 touch-manipulation",
                  isMobile ? "min-w-[56px] min-h-[56px] rounded-full" : "h-10 w-auto px-4 rounded-lg"
                )}
              >
                {isLoading ? (
                  <Loader2 className={twMerge(isMobile ? "w-6 h-6" : "w-5 h-5", "animate-spin")} />
                ) : (
                  <>
                    <span className="hidden md:inline font-medium text-sm">进入</span>
                    <ArrowRight className={twMerge(
                      isMobile ? "w-6 h-6" : "w-5 h-5",
                      "group-hover:translate-x-1 transition-transform"
                    )} />
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* 进度显示组件 */}
      {jobId && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="mt-6"
        >
          <ImportProgressDisplay
            jobId={jobId}
            onComplete={() => {
              console.log('导入完成');
            }}
            onError={(error) => {
              console.error('导入失败:', error);
            }}
          />
        </motion.div>
      )}

      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 1 }}
        className="fixed bottom-4 md:bottom-6 text-[10px] text-zinc-400 dark:text-zinc-600 font-mono select-none pointer-events-none hidden md:block"
      >
        ESC 退出后 · 可随时继续阅读
      </motion.footer>
    </section>
  );
}
