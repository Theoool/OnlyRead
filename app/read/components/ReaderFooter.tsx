import { motion } from "framer-motion";

export function ReaderFooter() {
  return (
    <motion.footer
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 2, duration: 1 }}
      className="fixed bottom-8 left-0 right-0 flex justify-center z-40 pointer-events-none"
    >
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
    </motion.footer>
  );
}
