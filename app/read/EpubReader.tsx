'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { LocalBook } from '@/lib/db';
import { useTheme } from 'next-themes';
import { Loader2, List, X, ArrowLeft, Minus, Plus, Sparkles, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useConceptStore, ConceptData } from '@/lib/store/useConceptStore';
import { ConceptHud } from '@/app/components/ConceptHud';
import { ConceptCard } from '@/app/components/ConceptCard';
import { twMerge } from 'tailwind-merge';
import { EpubView } from 'react-reader';
import { CopilotWidget } from '@/app/components/ai/CopilotWidget';

interface EpubReaderProps {
  book: LocalBook;
}

export function EpubReader({ book }: EpubReaderProps) {
  const [location, setLocation] = useState<string | number>(0);
  const [toc, setToc] = useState<any[]>([]);
  const renditionRef = useRef<any>(null);
  const [isTocOpen, setIsTocOpen] = useState(false);
  const [isHudOpen, setIsHudOpen] = useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false); // NEW: Sidebar state
  const [fontSize, setFontSize] = useState(100);
  const router = useRouter();
  const { theme } = useTheme();

  // Toolbar State
  const [toolbarState, setToolbarState] = useState<{
    isVisible: boolean;
    position: { top: number; left: number };
    text: string;
    cfiRange: string;
  }>({
    isVisible: false,
    position: { top: 0, left: 0 },
    text: '',
    cfiRange: ''
  });

  // Concept Store
  const { concepts, addConcept } = useConceptStore();
  const [activeCard, setActiveCard] = useState<{ x: number; y: number; term: string; savedData?: ConceptData } | null>(null);

  // Copilot Context
  const [copilotContext, setCopilotContext] = useState<{
      articleIds: string[];
      collectionId?: string;
      selection?: string;
  }>({
      articleIds: [], // Local books might not have IDs yet, or we use a placeholder
      collectionId: undefined,
      selection: undefined
  });

  // Set Copilot context when book loads
  useEffect(() => {
    if (book.id) {
        setCopilotContext(prev => ({ ...prev, articleIds: [book.id] }));
    }
  }, [book.id]);

  // 计算可见卡片
  const visibleCards = useMemo(() => {
    return Object.values(concepts);
  }, [concepts]);

  // 更新主题样式
  const updateTheme = useCallback((rendition: any) => {
    if (!rendition) return;
    const isDark = theme === 'dark';
    const textColor = isDark ? '#E4E4E7' : '#27272A';
    const bg = isDark ? '#000000' : '#FAFAFA';

    rendition.themes.register('custom', {
       body: {
         color: textColor,
         background: bg,
         'font-family': 'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"',
         'padding-top': '40px !important',
         'padding-bottom': '40px !important',
         'padding-left': '20px !important',
         'padding-right': '20px !important',
         'max-width': '800px !important',
         'margin': '0 auto !important',
       },
       'p': {
         'font-size': '1.125rem !important',
         'line-height': '1.8 !important',
         'text-align': 'justify !important',
         'margin-bottom': '1.5em !important'
       },
       'h1': { 'font-family': 'serif', 'margin-top': '2em' },
       'h2': { 'font-family': 'serif', 'margin-top': '1.5em' },
       'h3': { 'font-family': 'serif', 'margin-top': '1.2em' },
       'img': { 'max-width': '100%', 'border-radius': '0.5rem' },
       '::selection': {
           'background': isDark ? 'rgba(168, 85, 247, 0.4)' : 'rgba(168, 85, 247, 0.2)'
       }
    });
    rendition.themes.select('custom');
  }, [theme]);

  // 键盘导航
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const rendition = renditionRef.current;
      if (!rendition) return;

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case ' ':
          e.preventDefault();
          rendition.next();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          rendition.prev();
          break;
        case 'Escape':
          e.preventDefault();
          setIsTocOpen(false);
          setIsHudOpen(false);
          setIsCopilotOpen(false);
          setActiveCard(null);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 主题更新
  useEffect(() => {
      if (renditionRef.current) {
          updateTheme(renditionRef.current);
      }
  }, [theme, updateTheme]);

  // 字体大小更新
  useEffect(() => {
      const rendition = renditionRef.current;
      if (rendition) {
          rendition.themes.fontSize(`${fontSize}%`);
      }
  }, [fontSize]);

  // 处理选择激活
  const handleSelectionActivate = useCallback((text: string, rect: { x: number, y: number }, cfiRange: string) => {
    // 验证选择文本
    if (!text || text.trim().length < 1 || text.length > 100) return;

    const saved = concepts[text];
    setActiveCard({
        x: rect.x,
        y: rect.y,
        term: text,
        savedData: saved
    });
    
    // 隐藏工具栏
    setToolbarState(prev => ({ ...prev, isVisible: false }));
  }, [concepts]);

  // NEW: Handle Ask AI
  const handleAskAI = useCallback((text: string) => {
      // 1. Set context
      setCopilotContext(prev => ({ ...prev, selection: text }));
      // 2. Open Sidebar
      setIsCopilotOpen(true);
      // 3. Hide Toolbar
      setToolbarState(prev => ({ ...prev, isVisible: false }));
  }, []);

  // 保存卡片
  const handleSaveCard = useCallback(async (data: ConceptData) => {
      try {
          await addConcept({
              ...data
          });
          setActiveCard(null);

          // 清除 EPUB 中的选择
          const rendition = renditionRef.current;
          if (rendition?.getContents) {
            const contents = rendition.getContents();
            contents.forEach((content: any) => {
              if (content?.window?.getSelection) {
                content.window.getSelection().removeAllRanges();
              }
            });
          }
      } catch (error) {
          console.error('Failed to save concept:', error);
      }
  }, [addConcept, book.id]);

  // 获取选择坐标
  const getSelectionCoordinates = useCallback((range: Range, iframe: HTMLIFrameElement) => {
    try {
      const rect = range.getBoundingClientRect();
      const iframeRect = iframe.getBoundingClientRect();

      return {
        left: rect.left + iframeRect.left,
        top: rect.top + iframeRect.top,
        width: rect.width,
        height: rect.height,
        right: rect.left + iframeRect.left + rect.width,
        bottom: rect.top + iframeRect.top + rect.height,
        x: rect.left + iframeRect.left,
        y: rect.top + iframeRect.top,
        toJSON: () => ({})
      } as DOMRect;
    } catch (error) {
      console.error('Failed to get selection coordinates:', error);
      return null;
    }
  }, []);

  if (!book.fileData) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#FAFAFA] dark:bg-black">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-[#FAFAFA] dark:bg-black relative overflow-hidden flex flex-col">
       {/* Background Noise */}
       <div className="absolute inset-0 opacity-[0.015] pointer-events-none z-0 mix-blend-multiply dark:mix-blend-overlay"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
       />

       {/* Header */}
       <header className="fixed top-0 left-0 right-0 h-[60px] flex items-center justify-between px-6 z-40 pointer-events-none">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="pointer-events-auto flex items-center gap-2"
          >
             <button
               onClick={() => router.push('/')}
               className="flex items-center gap-2 bg-white/80 dark:bg-black/80 backdrop-blur-md px-3 py-2 rounded-full border border-zinc-200/50 dark:border-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors text-zinc-600 dark:text-zinc-400"
             >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-xs font-medium max-w-[150px] truncate">{book.title}</span>
             </button>
          </motion.div>

          <div className="flex items-center gap-2 pointer-events-auto">
             <ConceptHud
                cards={visibleCards}
                isOpen={isHudOpen}
                onOpenChange={setIsHudOpen}
                onTermClick={(term) => {
                    const saved = concepts[term];
                    if (saved) {
                        setActiveCard({
                            x: window.innerWidth / 2 - 140,
                            y: window.innerHeight / 2 - 100,
                            term,
                            savedData: saved
                        });
                    }
                }}
             />

             {/* Copilot Toggle */}
             <button
                onClick={() => setIsCopilotOpen(!isCopilotOpen)}
                className={twMerge(
                    "flex items-center gap-2 bg-white/80 dark:bg-black/80 backdrop-blur-md px-3 py-2 rounded-full border border-zinc-200/50 dark:border-zinc-800/50 transition-colors",
                    isCopilotOpen ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800" : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                )}
                title="AI 助手"
             >
                 <MessageSquare className="w-4 h-4" />
                 <span className="text-xs font-medium hidden sm:inline">Copilot</span>
             </button>

             <div className="flex items-center gap-1 bg-white/80 dark:bg-black/80 backdrop-blur-md px-2 py-1.5 rounded-full border border-zinc-200/50 dark:border-zinc-800/50">
                <button
                  onClick={() => setFontSize(s => Math.max(80, s - 10))}
                  className="p-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                  title="缩小字体"
                >
                    <Minus className="w-3 h-3" />
                </button>
                <span className="text-[10px] font-mono w-8 text-center text-zinc-500">{fontSize}%</span>
                <button
                  onClick={() => setFontSize(s => Math.min(200, s + 10))}
                  className="p-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                  title="放大字体"
                >
                    <Plus className="w-3 h-3" />
                </button>
             </div>

             <button
               onClick={() => setIsTocOpen(!isTocOpen)}
               className={twMerge(
                 "flex items-center gap-2 bg-white/80 dark:bg-black/80 backdrop-blur-md px-3 py-2 rounded-full border border-zinc-200/50 dark:border-zinc-800/50 transition-colors",
                 isTocOpen ? "bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100" : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900"
               )}
               title="目录"
             >
               <List className="w-4 h-4" />
             </button>
          </div>
       </header>

       {/* Reader Area */}
       <div className="flex-1 w-full h-full relative z-10 overflow-hidden flex">
           <div className="flex-1 relative">
                <EpubView
                    url={book.fileData}
                    location={location}
                    locationChanged={(loc: string | number) => setLocation(loc)}
                    tocChanged={(t) => setToc(t)}
                    epubOptions={{
                        flow: 'scrolled',
                        manager: 'continuous',
                        width: '100%',
                        height: '100%',
                    }}
                    getRendition={(rendition) => {
                        renditionRef.current = rendition;
                        updateTheme(rendition);

                        // 增强的选择处理
                        rendition.on('selected', (cfiRange: string, contents: any) => {
                            try {
                                const selection = contents.window.getSelection();
                                if (!selection || selection.rangeCount === 0) return;

                                // 获取所有选中的 range
                                const range = selection.getRangeAt(0);
                                const text = range.toString().trim();

                                if (!text || text.length < 1 || text.length > 300) { // Increased limit for AI context
                                    setToolbarState(prev => ({ ...prev, isVisible: false }));
                                    return;
                                }

                                // 获取 iframe
                                const iframes = (rendition as any).manager?.container?.querySelectorAll('iframe');
                                if (!iframes || iframes.length === 0) return;

                                // 找到包含选择的 iframe
                                let targetIframe: HTMLIFrameElement | null = null;
                                for (const item of Array.from(iframes)) {
                                const iframe = item as HTMLIFrameElement;
                                try {
                                    if (iframe.contentWindow === contents.window) {
                                    targetIframe = iframe;
                                    break;
                                    }
                                } catch (e) {
                                    continue;
                                }
                                }

                                if (!targetIframe) return;

                                const coords = getSelectionCoordinates(range, targetIframe);
                                if (!coords) return;

                                // 确保坐标在视口内
                                if (coords.x < 0 || coords.y < 0) return;

                                // 显示工具栏而不是直接激活
                                // 计算位置：在选择上方居中
                                const toolbarWidth = 140; // Increased width
                                const left = Math.max(16, coords.x + coords.width / 2 - toolbarWidth / 2);
                                const top = Math.max(16, coords.y - 60);

                                setToolbarState({
                                    isVisible: true,
                                    position: { top, left },
                                    text,
                                    cfiRange
                                });

                            } catch (error) {
                                console.error('Error handling selection:', error);
                            }
                        });

                        // 点击时关闭面板
                        rendition.on('click', () => {
                            setIsHudOpen(false);
                            setIsTocOpen(false);
                            // setIsCopilotOpen(false); // Don't close copilot on click
                            setToolbarState(prev => ({ ...prev, isVisible: false }));
                        });

                        // 位置变化时关闭卡片
                        rendition.on('locationChanged', () => {
                            setActiveCard(null);
                            setToolbarState(prev => ({ ...prev, isVisible: false }));
                        });
                    }}
                />
           </div>

           {/* Copilot Sidebar */}
           <AnimatePresence>
                {isCopilotOpen && (
                    <motion.div 
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: 400, opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        className="h-full border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl z-30"
                    >
                        <div className="flex flex-col h-full">
                            <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
                                <h3 className="font-semibold text-sm">AI Copilot</h3>
                                <button onClick={() => setIsCopilotOpen(false)} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <CopilotWidget 
                                    mode="copilot"
                                    variant="sidebar"
                                    context={copilotContext}
                                    initialMessages={copilotContext.selection ? [{
                                        id: 'context-preview',
                                        role: 'user',
                                        content: `Selected Context: "${copilotContext.selection.substring(0, 50)}..."`,
                                        createdAt: new Date().toISOString()
                                    }] : []}
                                />
                            </div>
                        </div>
                    </motion.div>
                )}
           </AnimatePresence>
       </div>

       {/* Footer */}
       <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 1 }}
        className="fixed bottom-8 left-0 right-0 flex justify-center z-40 pointer-events-none"
      >
        <div className="flex items-center gap-6 text-[10px] font-mono text-zinc-400 uppercase tracking-widest bg-white/50 dark:bg-black/50 backdrop-blur px-6 py-2 rounded-full border border-zinc-100 dark:border-zinc-900/50">
          <span className="flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-zinc-400" />
            Epub 阅读器 · 选中文本查看概念或询问 AI
          </span>
        </div>
      </motion.footer>

       {/* TOC Sidebar */}
       <AnimatePresence>
         {isTocOpen && (
           <motion.div
             initial={{ x: '100%' }}
             animate={{ x: 0 }}
             exit={{ x: '100%' }}
             transition={{ type: 'spring', damping: 25, stiffness: 200 }}
             className="fixed top-0 right-0 h-full w-80 bg-white/95 dark:bg-black/95 backdrop-blur shadow-2xl border-l border-zinc-200 dark:border-zinc-800 z-50 flex flex-col"
           >
             <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800 h-[60px]">
               <h2 className="font-medium text-sm text-zinc-900 dark:text-zinc-100">目录</h2>
               <button
                 onClick={() => setIsTocOpen(false)}
                 className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded text-zinc-500 transition-colors"
               >
                 <X className="w-4 h-4" />
               </button>
             </div>
             <div className="flex-1 overflow-y-auto p-2 no-scrollbar">
               {toc.length === 0 ? (
                 <div className="flex items-center justify-center h-full text-zinc-400 text-sm">
                   暂无目录
                 </div>
               ) : (
                 toc.map((chapter, i) => (
                   <button
                     key={i}
                     onClick={() => {
                         setLocation(chapter.href);
                         setIsTocOpen(false);
                     }}
                     className="w-full text-left py-2.5 px-3 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-lg transition-colors truncate"
                   >
                     {chapter.label}
                   </button>
                 ))
               )}
             </div>
           </motion.div>
         )}
       </AnimatePresence>

       {/* Concept Card Modal */}
       <AnimatePresence>
          {activeCard && (
              <ConceptCard
                  selection={activeCard.term}
                  position={{ top: activeCard.y, left: activeCard.x }}
                  savedData={activeCard.savedData}
                  onSave={handleSaveCard}
                  onClose={() => setActiveCard(null)}
              />
          )}
       </AnimatePresence>

       {/* Selection Toolbar */}
       <AnimatePresence>
         {toolbarState.isVisible && !activeCard && (
           <motion.div
             initial={{ opacity: 0, y: 10, scale: 0.8 }}
             animate={{ opacity: 1, y: 0, scale: 1 }}
             exit={{ opacity: 0, y: 10, scale: 0.8 }}
             transition={{ type: "spring", stiffness: 400, damping: 25 }}
             style={{ top: toolbarState.position.top, left: toolbarState.position.left }}
             className="fixed z-50"
           >
             <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 p-1 rounded-full shadow-lg border border-zinc-200 dark:border-zinc-800">
               {/* Concept Button */}
               <button
                 onClick={(e) => {
                   e.stopPropagation();
                   handleSelectionActivate(
                     toolbarState.text, 
                     { x: toolbarState.position.left, y: toolbarState.position.top + 50 }, 
                     toolbarState.cfiRange
                   );
                 }}
                 className="group flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 px-3 py-1.5 rounded-full transition-colors"
               >
                 <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                 <span className="text-xs font-medium">概念</span>
               </button>

               <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700 mx-0.5" />

               {/* Ask AI Button */}
               <button
                 onClick={(e) => {
                    e.stopPropagation();
                    handleAskAI(toolbarState.text);
                 }}
                 className="group flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-full transition-colors"
               >
                 <MessageSquare className="w-3.5 h-3.5" />
                 <span className="text-xs font-medium">Ask AI</span>
               </button>
             </div>
           </motion.div>
         )}
       </AnimatePresence>
    </div>
  );
}
