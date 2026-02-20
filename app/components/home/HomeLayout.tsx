"use client";

import { useState, useEffect } from "react";
import { useIsMobile } from "@/lib/hooks/use-device";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";

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
        <LayoutGroup>
          <div className="flex-none h-16 border-b border-zinc-200 dark:border-zinc-800 flex items-center bg-white dark:bg-black z-20 relative">
            <div className="flex w-full px-4 gap-2">
              <button
                onClick={() => setActiveTab('input')}
                className={`flex-1 h-12 flex items-center justify-center text-base font-semibold transition-colors rounded-xl touch-manipulation relative ${
                  activeTab === 'input'
                    ? 'text-zinc-900 dark:text-zinc-100'
                    : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
                }`}
              >
                <span className="relative z-10">阅读</span>
                {activeTab === 'input' && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-zinc-100 dark:bg-zinc-900 rounded-xl"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
              </button>
              <button
                onClick={() => setActiveTab('content')}
                className={`flex-1 h-12 flex items-center justify-center text-base font-semibold transition-colors rounded-xl touch-manipulation relative ${
                  activeTab === 'content'
                    ? 'text-zinc-900 dark:text-zinc-100'
                    : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
                }`}
              >
                <span className="relative z-10">记录</span>
                {activeTab === 'content' && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute  inset-0 bg-zinc-100 dark:bg-zinc-900 rounded-xl"
                    transition={{ type: "spring", bounce: 0.3, duration: 0.6 }}
                  />
                )}
              </button>
            </div>
          </div>
        </LayoutGroup>

        {/* 内容区域 */}
        <main className="flex-1 relative overflow-hidden">
          <AnimatePresence mode="wait">
            {activeTab === 'input' && childrenArray[0] && (
              <motion.div
                key="input"
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                className="absolute inset-0 overflow-y-auto"
              >
                {childrenArray[0]}
              </motion.div>
            )}
            {activeTab === 'content' && childrenArray[1] && (
              <motion.div
                key="content"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 30 }}
                transition={{ type: "spring", bounce: 0.1, duration: 0.4 }}
                className="absolute inset-0 overflow-y-auto"
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
