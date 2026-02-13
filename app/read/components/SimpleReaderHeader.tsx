import { motion } from "framer-motion";
import { BookOpen, List, Sparkles } from "lucide-react";
import { twMerge } from "tailwind-merge";
import { ConceptHud } from "@/app/components/ConceptHud";
import { ConceptData } from "@/lib/store/useConceptStore";

interface SimpleReaderHeaderProps {
  title: string;
  progress: number;
  tocAvailable: boolean;
  onTocToggle: () => void;
  visibleCards: ConceptData[];
  onTermClick: (term: string) => void;
  onAiToggle?: () => void;
}

export function SimpleReaderHeader({
  title,
  progress,
  tocAvailable,
  onTocToggle,
  visibleCards,
  onTermClick,
  onAiToggle,
}: SimpleReaderHeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 h-14 sm:h-16 md:h-[60px] flex items-center justify-between px-3 sm:px-4 md:px-12 z-30 pointer-events-none">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 bg-white/90 dark:bg-black/90 backdrop-blur-md px-3 py-2 sm:px-4 sm:py-2.5 md:px-4 md:py-2 rounded-2xl shadow-[0_4px_20px_rgb(0,0,0,0.08)] border border-zinc-200/50 dark:border-zinc-800/50 pointer-events-auto cursor-pointer active:scale-95 hover:bg-white dark:hover:bg-zinc-950 transition-all touch-manipulation"
        onClick={() => window.history.back()}
      >
        <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 md:w-4 md:h-4 text-zinc-500 dark:text-zinc-400" />
        <h1 className="text-sm font-medium truncate max-w-[80px] sm:max-w-[100px] md:max-w-[200px] text-zinc-800 dark:text-zinc-200">
          {title}
        </h1>
      </motion.div>

      <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 pointer-events-auto">
        {onAiToggle && (
            <motion.button
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                onClick={onAiToggle}
                className="hidden md:flex items-center gap-2 bg-white/90 dark:bg-black/90 backdrop-blur-md px-3 py-2 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 transition-all hover:bg-white dark:hover:bg-zinc-950 active:scale-95 group shadow-sm touch-manipulation"
                type="button"
            >
                <Sparkles className="w-4 h-4 text-indigo-400 group-hover:text-indigo-500" />
                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                    AI Copilot
                </span>
            </motion.button>
        )}

        <motion.button
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          onClick={onTocToggle}
          disabled={!tocAvailable}
          className={twMerge(
            "flex items-center justify-center gap-1.5 bg-white/90 dark:bg-black/90 backdrop-blur-md min-w-[40px] min-h-[40px] sm:min-w-[44px] sm:min-h-[44px] md:min-w-0 md:min-h-0 px-2.5 sm:px-3 md:px-3 py-2 sm:py-2.5 md:py-2 rounded-2xl md:rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 transition-all shadow-sm touch-manipulation",
            tocAvailable
              ? "hover:bg-white dark:hover:bg-zinc-950 active:scale-95"
              : "opacity-40 cursor-not-allowed"
          )}
          type="button"
        >
          <List className="w-4 h-4 sm:w-5 sm:h-5 md:w-4 md:h-4 text-zinc-500 dark:text-zinc-400" />
          <span className="hidden md:inline text-xs font-medium text-zinc-600 dark:text-zinc-300">
            目录
          </span>
        </motion.button>
        
        {/* Concept HUD */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="hidden md:block"
        >
          <ConceptHud
            cards={visibleCards}
            onTermClick={onTermClick}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 bg-white/90 dark:bg-black/90 backdrop-blur-md px-2.5 sm:px-3 md:px-4 py-2 sm:py-2.5 md:py-2 rounded-2xl md:rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 shadow-sm"
        >
          <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400 min-w-[3ch] text-right">
            {Math.round(progress)}%
          </span>
          <div className="w-12 sm:w-16 md:w-16 h-1.5 sm:h-2 md:h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-zinc-900 dark:bg-zinc-100"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: "circOut" }}
            />
          </div>
        </motion.div>
      </div>
    </header>
  );
}
