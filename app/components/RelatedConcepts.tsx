"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lightbulb, ArrowRight, Loader2 } from "lucide-react";
import { useConceptStore } from "@/lib/store/useConceptStore";
import { twMerge } from "tailwind-merge";

interface RelatedConceptsProps {
  currentText: string; // The text currently visible in the viewport or selected
  onConceptClick: (term: string) => void;
}

export function RelatedConcepts({ currentText, onConceptClick }: RelatedConceptsProps) {
  const { findRelatedConcepts } = useConceptStore();
  const [related, setRelated] = useState<Array<{ id: string; term: string; similarity: number }>>([]);
  const [loading, setLoading] = useState(false);

  // Debounce the search to avoid API spam
  useEffect(() => {
    if (!currentText || currentText.length < 50) return;

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        // Find concepts related to the current paragraph
        // We take a slice to avoid sending too much text
        const textSample = currentText.slice(0, 500); 
        const results = await findRelatedConcepts(textSample);
        setRelated(results);
      } catch (error) {
        console.error("Failed to find related concepts:", error);
      } finally {
        setLoading(false);
      }
    }, 1000); // 1s debounce

    return () => clearTimeout(timer);
  }, [currentText, findRelatedConcepts]);

  if (related.length === 0 && !loading) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="fixed right-6 top-24 w-64 z-40 hidden xl:block"
    >
      <div className="bg-white/80 dark:bg-black/80 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3 text-zinc-500 dark:text-zinc-400">
          <Lightbulb className="w-4 h-4 text-yellow-500" />
          <span className="text-xs font-medium uppercase tracking-wider">Related Concepts</span>
        </div>

        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {loading && related.length === 0 ? (
               <div className="flex justify-center py-4">
                  <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
               </div>
            ) : (
              related.map((concept) => (
                <motion.button
                  key={concept.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  onClick={() => onConceptClick(concept.term)}
                  className="w-full text-left group p-2.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200 group-hover:text-black dark:group-hover:text-white transition-colors">
                      {concept.term}
                    </span>
                    <ArrowRight className="w-3 h-3 text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0" />
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="h-1 flex-1 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-yellow-500/50 rounded-full"
                        style={{ width: `${Math.round(concept.similarity * 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      {Math.round(concept.similarity * 100)}%
                    </span>
                  </div>
                </motion.button>
              ))
            )}
          </AnimatePresence>
          
          {!loading && related.length === 0 && (
            <p className="text-xs text-zinc-400 text-center py-2">
              No direct connections found.
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
