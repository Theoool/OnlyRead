"use client";
import { motion } from "framer-motion";
import { useIsMobile } from "@/lib/hooks/use-device";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function ReaderFooter() {
  const isMobile = useIsMobile();

  return (
    <motion.footer
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 2, duration: 1 }}
      className="fixed bottom-6 md:bottom-8 left-0 right-0 flex justify-center z-40 pointer-events-none px-4"
    >
      {isMobile ? (
        <div className="flex items-center gap-3 text-[11px] font-mono text-zinc-400 bg-white/60 dark:bg-black/60 backdrop-blur-md px-5 py-2.5 rounded-full border border-zinc-200/50 dark:border-zinc-800/50">
          <span className="flex items-center gap-1.5">
            <ChevronLeft className="w-3 h-3" />
            <span>左滑回退</span>
          </span>
          <span className="w-px h-3 bg-zinc-300 dark:bg-zinc-700" />
          <span className="flex items-center gap-1.5">
            <span>右滑前进</span>
            <ChevronRight className="w-3 h-3" />
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-6 text-[10px] font-mono text-zinc-400 uppercase tracking-widest bg-white/50 dark:bg-black/50 backdrop-blur px-6 py-2 rounded-full border border-zinc-100 dark:border-zinc-900/50">
          <span className="flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-zinc-400" />
            空格阅读
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-zinc-400" />
            左键回退
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-zinc-400" />
            ESC 退出
          </span>
        </div>
      )}
    </motion.footer>
  );
}
