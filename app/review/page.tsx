"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useConceptStore, ConceptData } from "@/lib/store/useConceptStore";
import { calculateSRS } from "@/lib/srs";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Check, X, ArrowRight, RotateCw, Eye, EyeOff, Home } from "lucide-react";
import { getCachedConcept } from "@/lib/cache";

export default function ReviewPage() {
  const router = useRouter();
  const { concepts, updateConcept } = useConceptStore();
  const [queue, setQueue] = useState<ConceptData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  // AI Definition State (fetched from cache or placeholder)
  const [aiDefinition, setAiDefinition] = useState<string | null>(null);

  useEffect(() => {
    // Filter concepts due for review
    const now = Date.now();
    const due = Object.values(concepts).filter(c => {
      // If never reviewed, it's due. Or if nextReviewDate is passed.
      return !c.nextReviewDate || c.nextReviewDate <= now;
    });
    
    // Limit to 10 per session to keep it "Small & Beautiful"
    setQueue(due.sort((a, b) => (a.nextReviewDate || 0) - (b.nextReviewDate || 0)).slice(0, 10));
  }, [concepts]);

  const currentCard = queue[currentIndex];

  useEffect(() => {
      if (currentCard) {
          const cached = getCachedConcept<any>(currentCard.term);
          setAiDefinition(cached?.definition || "AI definition unavailable.");
      }
  }, [currentCard]);

  const handleRate = (quality: number) => {
    if (!currentCard) return;

    const updates = calculateSRS(currentCard, quality);
    updateConcept(currentCard.term, updates);

    if (currentIndex < queue.length - 1) {
      setIsFlipped(false);
      setTimeout(() => setCurrentIndex(prev => prev + 1), 300);
    } else {
      setIsFinished(true);
    }
  };

  if (queue.length === 0 && !isFinished) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-zinc-50 dark:bg-black p-6 text-center">
        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-6">
          <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
        </div>
        <h1 className="text-2xl font-serif font-medium text-zinc-900 dark:text-zinc-100 mb-2">
          All Caught Up!
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 mb-8 max-w-xs">
          You've reviewed all pending concepts for today. Great job keeping your memory sharp.
        </p>
        <button 
          onClick={() => router.push("/")}
          className="px-6 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black rounded-full font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
        >
          <Home className="w-4 h-4" /> Back Home
        </button>
      </div>
    );
  }

  if (isFinished) {
      return (
        <div className="h-screen flex flex-col items-center justify-center bg-zinc-50 dark:bg-black p-6 text-center">
            <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-full max-w-md bg-white dark:bg-zinc-900 p-8 rounded-3xl shadow-xl border border-zinc-100 dark:border-zinc-800"
            >
                <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Brain className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                </div>
                <h1 className="text-2xl font-serif font-medium text-zinc-900 dark:text-zinc-100 mb-2">
                    Session Complete
                </h1>
                <p className="text-zinc-500 dark:text-zinc-400 mb-8">
                    You've reviewed {queue.length} concepts today.
                </p>
                <button 
                    onClick={() => router.push("/")}
                    className="w-full py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black rounded-xl font-medium hover:opacity-90 transition-opacity"
                >
                    Return Home
                </button>
            </motion.div>
        </div>
      )
  }

  if (!currentCard) return null; // Should not happen due to queue check

  return (
    <div className="h-screen w-full bg-zinc-100 dark:bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Progress Bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-zinc-200 dark:bg-zinc-800">
          <motion.div 
            className="h-full bg-purple-500"
            initial={{ width: 0 }}
            animate={{ width: `${((currentIndex) / queue.length) * 100}%` }}
          />
      </div>

      <div className="absolute top-6 right-6 text-xs font-mono text-zinc-400">
          {currentIndex + 1} / {queue.length}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentCard.term}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="w-full max-w-2xl"
        >
            <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden min-h-[400px] flex flex-col">
                {/* Phase 1: Retrieval (Front) */}
                <div className="flex-1 p-8 md:p-12 flex flex-col items-center justify-center text-center relative">
                    <h2 className="text-4xl md:text-5xl font-serif font-bold text-zinc-900 dark:text-zinc-100 mb-8">
                        {currentCard.term}
                    </h2>
                    
                    {!isFlipped ? (
                        <div className="space-y-6">
                            <p className="text-zinc-400 dark:text-zinc-500 italic text-lg">
                                "Recall the definition in your mind..."
                            </p>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setIsFlipped(true)}
                                className="mt-8 px-8 py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black rounded-full font-medium shadow-lg hover:shadow-xl transition-all flex items-center gap-2 mx-auto"
                            >
                                <Eye className="w-4 h-4" /> Reveal Answer
                            </motion.button>
                        </div>
                    ) : (
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="w-full grid grid-cols-1 md:grid-cols-2 gap-8 text-left"
                        >
                            {/* User Definition */}
                            <div className="p-6 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Your Memory</span>
                                </div>
                                <p className="text-zinc-800 dark:text-zinc-200 leading-relaxed">
                                    {currentCard.myDefinition}
                                </p>
                                {currentCard.myExample && (
                                    <p className="mt-4 text-sm text-zinc-500 italic border-t border-zinc-200 dark:border-zinc-700 pt-3">
                                        Ex: {currentCard.myExample}
                                    </p>
                                )}
                            </div>

                            {/* AI Definition */}
                            <div className="p-6 bg-purple-50 dark:bg-purple-900/10 rounded-2xl border border-purple-100 dark:border-purple-900/20">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-2 h-2 bg-purple-500 rounded-full" />
                                    <span className="text-xs font-bold uppercase tracking-wider text-purple-400">AI Reference</span>
                                </div>
                                <p className="text-zinc-800 dark:text-zinc-200 leading-relaxed">
                                    {aiDefinition}
                                </p>
                            </div>
                        </motion.div>
                    )}
                </div>

                {/* Phase 3: Feedback (Bottom Bar) */}
                {isFlipped && (
                    <motion.div 
                        initial={{ y: 100 }}
                        animate={{ y: 0 }}
                        className="p-6 bg-zinc-50 dark:bg-black/50 border-t border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row items-center justify-between gap-4"
                    >
                        <span className="text-sm text-zinc-400 font-medium uppercase tracking-widest">How was your recall?</span>
                        <div className="flex gap-3 w-full md:w-auto">
                            <button onClick={() => handleRate(1)} className="flex-1 md:flex-none px-6 py-3 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors">
                                Forgot
                            </button>
                            <button onClick={() => handleRate(3)} className="flex-1 md:flex-none px-6 py-3 rounded-xl bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 font-medium hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition-colors">
                                Hard
                            </button>
                            <button onClick={() => handleRate(4)} className="flex-1 md:flex-none px-6 py-3 rounded-xl bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 font-medium hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors">
                                Easy
                            </button>
                        </div>
                    </motion.div>
                )}
            </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}