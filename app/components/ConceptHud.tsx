import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Hexagon } from "lucide-react";
import { ConceptData } from "@/lib/store/useConceptStore";

interface ConceptHudProps {
  cards: ConceptData[];
  onTermClick?: (term: string) => void;
}

export function ConceptHud({ cards, onTermClick }: ConceptHudProps) {
  const maxCards = 5;
  const count = cards.length;

  return (
    <div className="group relative pointer-events-auto">
      {/* Trigger Pill */}
      <motion.div 
        layout
        className="flex items-center gap-2 bg-white/80 dark:bg-black/80 backdrop-blur-md px-3 py-2 rounded-full border border-zinc-200/50 dark:border-zinc-800/50 cursor-default hover:bg-white dark:hover:bg-zinc-900 transition-colors shadow-sm"
      >
        <div className={`p-1 rounded-full ${count > 0 ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800'}`}>
            <Hexagon className="w-3 h-3 fill-current" />
        </div>
        
        <div className="flex items-center gap-1">
            {[...Array(maxCards)].map((_, i) => (
                <motion.div 
                    key={i}
                    initial={false}
                    animate={{ 
                        scale: i < count ? 1 : 0.8,
                        backgroundColor: i < count ? "rgb(168 85 247)" : "transparent" // purple-500
                    }}
                    className={`w-1.5 h-1.5 rounded-full border ${i < count ? 'border-purple-500' : 'border-zinc-300 dark:border-zinc-700 bg-transparent'}`}
                />
            ))}
        </div>
      </motion.div>

      {/* Dropdown List (Hover) */}
      <div className="absolute top-full right-0 mt-2 w-48 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform origin-top-right z-50">
        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-100 dark:border-zinc-800 overflow-hidden p-1">
            <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800/50">
                <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-mono">已收集概念</p>
            </div>
            
            {count === 0 ? (
                <div className="p-4 text-center">
                    <p className="text-xs text-zinc-400 italic">暂无收集概念。</p>
                </div>
            ) : (
                <div className="max-h-[200px] overflow-y-auto py-1">
                    {cards.map((card, i) => (
                        <button
                            key={i}
                            onClick={() => onTermClick?.(card.term)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg transition-colors flex items-center justify-between group/item"
                        >
                            <span className="text-zinc-700 dark:text-zinc-300 truncate font-medium">{card.term}</span>
                            {card.confidence && (
                                <span className="text-[10px] text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-full group-hover/item:bg-white dark:group-hover/item:bg-zinc-700 transition-colors">
                                    {card.confidence}/5
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
