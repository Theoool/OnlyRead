'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  PanelLeftClose, 
  PanelLeftOpen,
  MoreVertical,
  Trash2,
  Edit3,
  X,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { CopilotWidget } from '@/app/components/ai/CopilotWidget';
import { ContextSelector } from '@/app/components/ai/ContextSelector';
import { Message } from '@/app/components/ai/useCopilot';

interface Article {
  id: string;
  title: string;
  domain?: string;
  collectionId?: string;
}

interface Collection {
  id: string;
  title: string;
  type: string;
}

interface SessionClientPageProps {
  sessionId: string;
  sessionTitle: string;

  context: {
    articleIds: string[];
    collectionId?: string;
  };
  articles: Article[];
  collections: Collection[];
}

export function SessionClientPage({
  sessionId,
  sessionTitle,
 
  context: initialContext,
  articles,
  collections
}: SessionClientPageProps) {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // 默认关闭，移动端友好
  const [context, setContext] = useState(initialContext);
  const [showOptions, setShowOptions] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // 检测移动端
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // 桌面端默认打开侧边栏
      if (!mobile && !isSidebarOpen) {
        setIsSidebarOpen(true);
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleDeleteSession = async () => {
    if (!confirm('确定要删除这个学习会话吗？此操作不可撤销。')) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/learning/sessions/${sessionId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Failed to delete session');
      
      router.push('/learning');
    } catch (error) {
      console.error('Failed to delete session:', error);
      alert('删除失败，请重试');
    } finally {
      setIsDeleting(false);
      setShowOptions(false);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  return (
    <div className="h-[100dvh] bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-50 flex overflow-hidden">
      {/* Sidebar - Context Selector - 移动端全屏覆盖 */}
      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <>
            {/* 移动端遮罩 */}
            {isMobile && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsSidebarOpen(false)}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 md:hidden"
              />
            )}
            
            {/* 侧边栏 */}
            <motion.aside 
              initial={isMobile ? { x: '-100%' } : { width: 0, opacity: 0 }}
              animate={isMobile ? { x: 0 } : { width: 320, opacity: 1 }}
              exit={isMobile ? { x: '-100%' } : { width: 0, opacity: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className={`
                h-full bg-white dark:bg-zinc-900 z-40 flex-shrink-0 flex flex-col
                ${isMobile ? 'fixed left-0 top-0 w-[85vw] max-w-sm shadow-2xl' : 'relative border-r border-zinc-200 dark:border-zinc-800'}
              `}
            >
              {/* 侧边栏头部 */}
              <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between flex-shrink-0">
                <h2 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                  学习材料
                </h2>
                {isMobile && (
                  <button
                    onClick={() => setIsSidebarOpen(false)}
                    className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors touch-manipulation"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              
              {/* 上下文选择器 */}
              <div className="flex-1 overflow-hidden">
                <ContextSelector 
                  articles={articles}
                  collections={collections}
                  selectedContext={context}
                  onContextChange={setContext}
                />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-black relative overflow-hidden">
        {/* Header - 移动端优化 */}
        <header className="sticky top-0 z-20 bg-white/90 dark:bg-black/90 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 flex-shrink-0 safe-top">
          <div className="w-full px-3 sm:px-4 h-14 flex items-center justify-between gap-2">
            {/* 左侧按钮组 */}
            <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-1">
              <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500 touch-manipulation active:scale-90 flex-shrink-0"
                aria-label={isSidebarOpen ? '关闭侧边栏' : '打开侧边栏'}
              >
                {isSidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
              </button>
              
              <button
                onClick={() => router.push('/learning')}
                className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500 touch-manipulation active:scale-90 flex-shrink-0"
                aria-label="返回学习中心"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              <h1 className="font-medium text-sm truncate min-w-0">
                {sessionTitle}
              </h1>
            </div>
            
            {/* 右侧按钮组 */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* 全屏按钮 - 仅桌面端显示 */}
              {!isMobile && (
                <button
                  onClick={toggleFullscreen}
                  className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500 touch-manipulation active:scale-90"
                  aria-label={isFullscreen ? '退出全屏' : '全屏'}
                >
                  {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
              )}

              {/* 更多选项 */}
              <div className="relative">
                <button 
                  onClick={() => setShowOptions(!showOptions)}
                  className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500 touch-manipulation active:scale-90"
                  aria-label="更多选项"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                <AnimatePresence>
                  {showOptions && (
                    <>
                      {/* 移动端遮罩 */}
                      {isMobile && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          onClick={() => setShowOptions(false)}
                          className="fixed inset-0 z-40"
                        />
                      )}
                      
                      {/* 选项菜单 */}
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 400 }}
                        className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden z-50"
                      >
                        <button
                          onClick={handleDeleteSession}
                          disabled={isDeleting}
                          className="w-full px-4 py-3 text-left flex items-center gap-3 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors touch-manipulation active:bg-red-100 dark:active:bg-red-900/30"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="text-sm font-medium">
                            {isDeleting ? '删除中...' : '删除会话'}
                          </span>
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </header>
       
        {/* Chat Area - 移动端全屏优化 */}
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <CopilotWidget 
            sessionId={sessionId}
            variant="full"
            context={context}
          />
        </main>
      </div>
    </div>
  );
}
