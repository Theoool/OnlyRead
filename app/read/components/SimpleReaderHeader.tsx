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
    <header className="fixed top-0 left-0 right-0 h-14 md:h-[60px] flex items-center justify-between px-3 md:px-12 z-30 pointer-events-none">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 md:gap-3 bg-white/80 dark:bg-black/80 backdrop-blur-md px-3 py-2 md:px-4 md:py-2 rounded-xl shadow-[0_4px_20px_rgb(0,0,0,0.08)] border border-zinc-200/50 dark:border-zinc-800/50 pointer-events-auto cursor-pointer hover:bg-white dark:hover:bg-zinc-950 transition-colors"
        onClick={() => window.history.back()}
      >
        <BookOpen className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
        <h1 className="text-sm font-medium truncate max-w-[120px] md:max-w-[200px] text-zinc-800 dark:text-zinc-200">
          {title}
        </h1>
      </motion.div>

      <div className="flex items-center gap-1.5 md:gap-3 pointer-events-auto">
        {onAiToggle && (
            <motion.button
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                onClick={onAiToggle}
                className="hidden md:flex items-center gap-2 bg-white/80 dark:bg-black/80 backdrop-blur-md px-3 py-2 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 transition-colors hover:bg-white dark:hover:bg-zinc-950 group shadow-sm"
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
          className={twMerge(
            "flex items-center gap-1.5 md:gap-2 bg-white/80 dark:bg-black/80 backdrop-blur-md px-2.5 md:px-3 py-2 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 transition-colors shadow-sm",
            tocAvailable
              ? "hover:bg-white dark:hover:bg-zinc-950"
              : "opacity-40 cursor-not-allowed"
          )}
          type="button"
        >
          <List className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
          <span className="hidden md:inline text-xs font-medium text-zinc-600 dark:text-zinc-300">
            目录
          </span>
        </motion.button>
        
        {/* Concept HUD */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <ConceptHud
            cards={visibleCards}
            onTermClick={onTermClick}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 md:gap-3 bg-white/80 dark:bg-black/80 backdrop-blur-md px-2.5 md:px-4 py-2 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 shadow-sm"
        >
          <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400 min-w-[3ch] text-right">
            {Math.round(progress)}%
          </span>
          <div className="w-12 md:w-16 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
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
