import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Hexagon, ChevronDown, X } from "lucide-react";
import { ConceptData } from "@/lib/store/useConceptStore";
import { twMerge } from "tailwind-merge";

interface ConceptHudProps {
  cards: ConceptData[];
  onTermClick?: (term: string) => void;
  // Controlled state (optional)
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ConceptHud({ cards, onTermClick, isOpen: controlledOpen, onOpenChange }: ConceptHudProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Use controlled state if provided, otherwise internal
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  
  const handleOpenChange = (open: boolean) => {
    if (!isControlled) {
      setInternalOpen(open);
    }
    onOpenChange?.(open);
  };

  const maxCards = 5;
  const count = cards.length;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        handleOpenChange(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]); // Only depend on isOpen, not handleOpenChange to avoid re-bind

  return (
    <div className="relative pointer-events-auto z-50" ref={containerRef}>
      {/* Trigger Pill */}
      <motion.button
        layout
        onClick={() => handleOpenChange(!isOpen)}
        className={twMerge(
          "flex items-center gap-2 bg-white/90 dark:bg-black/90 backdrop-blur-xl px-3 py-2 rounded-full border transition-all shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-purple-500",
          isOpen 
            ? "border-purple-500 ring-2 ring-purple-500/20" 
            : "border-zinc-200/50 dark:border-zinc-800/50 hover:bg-white dark:hover:bg-zinc-900"
        )}
      >
        <div className={twMerge(
          "p-1 rounded-full transition-colors",
          count > 0 
            ? "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" 
            : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800"
        )}>
            <Hexagon className="w-3.5 h-3.5 fill-current" />
        </div>
        
        <div className="flex items-center gap-1.5 px-1">
            {[...Array(maxCards)].map((_, i) => (
                <motion.div 
                    key={i}
                    initial={false}
                    animate={{ 
                        scale: i < count ? 1 : 0.8,
                        backgroundColor: i < count ? "rgb(168 85 247)" : "transparent"
                    }}
                    className={twMerge(
                        "w-1.5 h-1.5 rounded-full border transition-colors duration-300",
                         i < count 
                            ? "border-purple-500" 
                            : "border-zinc-300 dark:border-zinc-700 bg-transparent"
                    )}
                />
            ))}
        </div>

        <ChevronDown className={twMerge(
            "w-3 h-3 text-zinc-400 transition-transform duration-300",
            isOpen && "rotate-180"
        )} />
      </motion.button>

      {/* Dropdown List */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="absolute top-full right-0 mt-3 w-64 origin-top-right"
          >
            <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-zinc-200/50 dark:border-zinc-800/50 overflow-hidden ring-1 ring-black/5">
                <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-900/50">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-bold font-mono">
                        已收集概念 ({count})
                    </p>
                    <button 
                        onClick={() => handleOpenChange(false)}
                        className="p-1 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-400 transition-colors"
                    >
                        <X className="w-3 h-3" />
                    </button>
                </div>
                
                {count === 0 ? (
                    <div className="p-8 text-center flex flex-col items-center gap-2">
                        <Hexagon className="w-8 h-8 text-zinc-200 dark:text-zinc-800 stroke-[1.5]" />
                        <p className="text-xs text-zinc-400">阅读时点击高亮词汇即可收集</p>
                    </div>
                ) : (
                    <div className="max-h-[300px] overflow-y-auto p-2 space-y-1 no-scrollbar">
                        {cards.map((card, i) => (
                            <motion.button
                                key={card.term}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.05 }}
                                onClick={() => {
                                    onTermClick?.(card.term);
                                    handleOpenChange(false);
                                }}
                                className="w-full text-left px-3 py-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 rounded-xl transition-all flex items-center justify-between group"
                            >
                                <div className="flex flex-col items-start gap-0.5 min-w-0">
                                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200 truncate w-full group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                                        {card.term}
                                    </span>
                                    <span className="text-[10px] text-zinc-400 truncate max-w-[140px]">
                                        {card.myDefinition || "AI 自动生成定义..."}
                                    </span>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                    {card.confidence && (
                                        <div className="flex gap-0.5">
                                            {[...Array(5)].map((_, idx) => (
                                                <div 
                                                    key={idx} 
                                                    className={twMerge(
                                                        "w-1 h-1 rounded-full",
                                                        idx < card.confidence 
                                                            ? "bg-purple-400" 
                                                            : "bg-zinc-200 dark:bg-zinc-700"
                                                    )} 
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </motion.button>
                        ))}
                    </div>
                )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
