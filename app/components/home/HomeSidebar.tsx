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
import { useFileImport } from "@/lib/hooks/home/useFileImport";
import { isUrl } from "@/lib/utils";
import { SearchBar } from "@/app/components/SearchBar";
import { QuickStats } from "./QuickStats";

interface HomeSidebarProps {
  onSuccess?: (mode: 'articles' | 'collections') => void;
}

export function HomeSidebar({ onSuccess }: HomeSidebarProps) {
  const router = useRouter();
  const { isAuthenticated, user, logout, isLoading: isAuthLoading } = useAuthStore();
  const [value, setValue] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { 
    handleFile, 
    handleUrlImport, 
    handleTextPaste, 
    loading, 
    error,
    setError 
  } = useFileImport({ 
    userId: user?.id, 
    onSuccess: (mode) => {
      setValue("");
      onSuccess?.(mode);
    },
    onLocalReady: (localId) => {
      // 【本地优先】文件存入 IndexedDB 后立即跳转阅读
      router.push(`/read?localId=${localId}`);
    }
  });

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
      handleFile(files[0]);
    }
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
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
    if (!input || loading) return;

    if (isUrl(input)) {
      await handleUrlImport(input);
    } else {
      await handleTextPaste(input);
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
        "w-full md:w-1/2 lg:w-[55%] flex flex-col p-6 md:p-12 relative z-10 bg-white dark:bg-black border-b md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-800 transition-colors duration-200",
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
        className="mb-6 flex items-center justify-between"
      >
        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <span className="w-2 h-2 bg-black dark:bg-white rounded-full inline-block"/>
          阅读
        </h1>

        {/* Auth UI */}
        <div className="flex items-center gap-3">
          {isAuthenticated && user ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm">
                {user.avatarUrl && (
                  <Image
                    src={user.avatarUrl}
                    alt={user.fullName || user.email || "User"}
                    width={24}
                    height={24}
                    className="w-6 h-6 rounded-full"
                    unoptimized
                  />
                )}
                <span className="text-zinc-600 dark:text-zinc-400">
                  {user.fullName || user.email?.split('@')[0]}
                </span>
              </div>
              <button
                onClick={async () => {
                  await logout();
                  window.location.href = '/';
                }}
                disabled={isAuthLoading}
                className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => window.location.href = '/auth'}
              className="flex items-center gap-2 px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
            >
              <User className="w-4 h-4" />
              登录
            </button>
          )}
        </div>
      </motion.header>

      <QuickStats />

      {/* Learning Center Entry */}
      {isAuthenticated && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="mb-4"
        >
          <Link
            href="/learning"
            className="flex items-center gap-3 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors group"
          >
            <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
                学习中心
              </div>
              <div className="text-xs text-zinc-500">
                AI 导师陪伴你的学习之旅
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-indigo-500 group-hover:translate-x-1 transition-transform" />
          </Link>
        </motion.div>
      )}

      {/* Search Bar */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mb-6"
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
            className="w-full h-[30vh] md:h-[40vh] bg-transparent text-2xl md:text-4xl font-mono leading-tight outline-none resize-none placeholder:text-zinc-200 dark:placeholder:text-zinc-800"
            placeholder="你想阅读什么？"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            spellCheck={false}
          />
          
          {/* Input Actions */}
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between">
            <div className="flex items-center gap-4">
               {/* Type Indicator */}
               <AnimatePresence>
                {value && (
                  <motion.span
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="text-xs font-mono text-zinc-400 px-2 py-1 bg-zinc-100 dark:bg-zinc-900 rounded"
                  >
                    {isInputUrl ? "检测到链接" : "纯文本"}
                  </motion.span>
                )}
              </AnimatePresence>
              
              {/* Error Message */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="flex items-center gap-2 text-xs text-red-500 font-mono bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded"
                  >
                    <AlertCircle className="w-3 h-3" />
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex items-center gap-2">
              {!value && (
                <>
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => fileInputRef.current?.click()}
                    className="h-8 px-3 rounded bg-zinc-100 dark:bg-zinc-900 text-zinc-500 text-xs font-mono flex items-center gap-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <FileText className="w-3 h-3" />
                    导入
                  </motion.button>

                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handlePasteClick}
                    className="h-8 px-3 rounded bg-zinc-100 dark:bg-zinc-900 text-zinc-500 text-xs font-mono flex items-center gap-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <Clipboard className="w-3 h-3" />
                    粘贴
                  </motion.button>
                </>
              )}
              
              <button
                onClick={handleSubmit}
                disabled={!value || loading}
                className="h-10 w-10 md:w-auto md:px-4 rounded-full md:rounded-lg bg-black dark:bg-white text-white dark:text-black disabled:opacity-0 transition-all flex items-center justify-center gap-2 group"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span className="hidden md:inline font-medium text-sm">进入</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 1 }}
        className="fixed bottom-6 text-[10px] text-zinc-400 dark:text-zinc-600 font-mono select-none pointer-events-none"
      >
        ESC 退出后 · 可随时继续阅读
      </motion.footer>
    </section>
  );
}
