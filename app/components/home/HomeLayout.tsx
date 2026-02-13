"use client";

import { useState, useEffect } from "react";
import { useIsMobile } from "@/lib/hooks/use-device";
import { motion, AnimatePresence } from "framer-motion";

interface HomeLayoutProps {
  children: React.ReactNode;
}

type TabType = 'input' | 'content';

export function HomeLayout({ children }: HomeLayoutProps) {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<TabType>('input');
  const [childrenArray, setChildrenArray] = useState<React.ReactNode[]>([]);

  useEffect(() => {
    // 将 children 转换为数组以便单独访问
    const childrenList = Array.isArray(children) ? children : [children];
    setChildrenArray(childrenList);
  }, [children]);

  // 移动端使用标签页切换
  if (isMobile) {
    return (
      <div className="h-screen w-full flex flex-col bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-50 font-sans overflow-hidden">
        {/* 移动端标签栏 */}
        <div className="flex-none h-14 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-around bg-white dark:bg-black px-2 z-20">
          <button
            onClick={() => setActiveTab('input')}
            className={`flex-1 h-full flex items-center justify-center text-base font-medium transition-all border-b-2 active:scale-95 touch-manipulation ${
              activeTab === 'input'
                ? 'border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100'
                : 'border-transparent text-zinc-400'
            }`}
          >
            阅读
          </button>
          <button
            onClick={() => setActiveTab('content')}
            className={`flex-1 h-full flex items-center justify-center text-base font-medium transition-all border-b-2 active:scale-95 touch-manipulation ${
              activeTab === 'content'
                ? 'border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100'
                : 'border-transparent text-zinc-400'
            }`}
          >
            记录
          </button>
        </div>

        {/* 内容区域 */}
        <main className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait">
            {activeTab === 'input' && childrenArray[0] && (
              <motion.div
                key="input"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0"
              >
                {childrenArray[0]}
              </motion.div>
            )}
            {activeTab === 'content' && childrenArray[1] && (
              <motion.div
                key="content"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0"
              >
                {childrenArray[1]}
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    );
  }

  // 桌面端保持原有布局
  return (
    <div className="h-screen w-full flex flex-col bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-50 font-sans overflow-hidden">
      <main className="flex-1 flex flex-col md:flex-row h-full overflow-hidden">
        {children}
      </main>
    </div>
  );
}
