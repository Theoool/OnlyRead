import { motion } from "framer-motion";
import { Brain, Flame, TrendingUp } from "lucide-react";
import { useQuickStats } from "@/lib/hooks/home/useQuickStats";

export function QuickStats() {
  const { data: stats } = useQuickStats();

  if (!stats) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="grid grid-cols-3 gap-3 mb-6"
    >
      <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 border border-purple-100 dark:border-purple-900/30">
        <div className="flex items-center gap-2 mb-1">
          <Brain className="w-3 h-3 text-purple-600 dark:text-purple-400" />
          <span className="text-xs font-medium text-purple-600 dark:text-purple-400">复习</span>
        </div>
        <div className="text-lg font-bold text-zinc-900 dark:text-white">{stats.dueCount}</div>
      </div>
      <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 border border-orange-100 dark:border-orange-900/30">
        <div className="flex items-center gap-2 mb-1">
          <Flame className="w-3 h-3 text-orange-600 dark:text-orange-400" />
          <span className="text-xs font-medium text-orange-600 dark:text-orange-400">连续打卡</span>
        </div>
        <div className="text-lg font-bold text-zinc-900 dark:text-white">{stats.currentStreak}</div>
      </div>
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-100 dark:border-blue-900/30">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="w-3 h-3 text-blue-600 dark:text-blue-400" />
          <span className="text-xs font-medium text-blue-600 dark:text-blue-400">卡片</span>
        </div>
        <div className="text-lg font-bold text-zinc-900 dark:text-white">{stats.totalConcepts}</div>
      </div>
    </motion.div>
  );
}
