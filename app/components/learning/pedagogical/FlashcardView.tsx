import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flashcard } from '@/lib/core/learning/schemas';
import { Card, CardContent } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { ChevronLeft, ChevronRight, RotateCcw, HelpCircle, Save } from 'lucide-react';

interface FlashcardViewProps {
    data: Flashcard;
    onAction?: (action: string, value?: any) => void;
}

export const FlashcardView: React.FC<FlashcardViewProps> = ({ data, onAction }) => {
    const [index, setIndex] = useState(data.currentIndex || 0);
    const [isFlipped, setIsFlipped] = useState(false);
    const cards = data.cards;

    const next = () => {
        if (index < cards.length - 1) {
            setIndex(index + 1);
            setIsFlipped(false);
        }
    };

    const prev = () => {
        if (index > 0) {
            setIndex(index - 1);
            setIsFlipped(false);
        }
    };

    const currentCard = cards[index];

    return (
        <div className="w-full max-w-sm mx-auto space-y-6">
            <div className="relative h-64 w-full perspective-1000">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="w-full h-full relative preserve-3d group cursor-pointer"
                        onClick={() => setIsFlipped(!isFlipped)}
                    >
                        <motion.div
                            animate={{ rotateY: isFlipped ? 180 : 0 }}
                            transition={{ duration: 0.6, type: 'spring', stiffness: 260, damping: 20 }}
                            className="w-full h-full backface-hidden"
                        >
                            {/* Front */}
                            <Card className={cn(
                                "w-full h-full flex flex-col items-center justify-center p-8 text-center bg-white dark:bg-zinc-900 border-2 border-zinc-100 dark:border-zinc-800 rounded-3xl shadow-xl transition-shadow group-hover:shadow-2xl",
                                isFlipped && "invisible"
                            )}>
                                <HelpCircle className="w-8 h-8 text-blue-500 mb-4 opacity-50" />
                                <h3 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 leading-tight">
                                    {currentCard.front}
                                </h3>
                                {currentCard.hint && (
                                    <p className="mt-4 text-xs text-zinc-400 group-hover:opacity-100 transition-opacity">
                                        💡 Click to flip for hint
                                    </p>
                                )}
                            </Card>

                            {/* Back */}
                            <Card className={cn(
                                "absolute inset-0 w-full h-full flex flex-col items-center justify-center p-8 text-center bg-blue-50 dark:bg-zinc-950 border-2 border-blue-200 dark:border-blue-900/30 rounded-3xl shadow-xl transition-shadow rotate-y-180 backface-hidden",
                                !isFlipped && "invisible"
                            )}>
                                <div className="absolute top-4 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-widest text-blue-500 font-bold">
                                    Explanation
                                </div>
                                <p className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
                                    {currentCard.back}
                                </p>
                                {currentCard.hint && (
                                    <p className="mt-6 text-sm italic text-blue-600/70 dark:text-blue-400/70">
                                        Hint: {currentCard.hint}
                                    </p>
                                )}
                            </Card>
                        </motion.div>
                    </motion.div>
                </AnimatePresence>

                {/* Floating Difficulty Badges (Optional) */}
                {currentCard.difficulty && (
                    <div className="absolute -top-3 -right-3 px-3 py-1 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[10px] font-bold uppercase tracking-tighter shadow-lg z-10">
                        {currentCard.difficulty}
                    </div>
                )}
            </div>

            {/* SRS Rating Buttons - Only show when card is flipped */}
            <AnimatePresence>
                {isFlipped && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="flex items-center justify-center gap-2 px-4"
                    >
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onAction?.('srs_review', { cardIndex: index, quality: 1, card: currentCard });
                                next();
                            }}
                            className="flex flex-col items-center gap-1 px-3 py-2 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                        >
                            <span className="text-lg">😵</span>
                            <span className="text-xs text-red-600 dark:text-red-400 font-medium">忘了</span>
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onAction?.('srs_review', { cardIndex: index, quality: 2, card: currentCard });
                                next();
                            }}
                            className="flex flex-col items-center gap-1 px-3 py-2 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30 rounded-lg transition-colors"
                        >
                            <span className="text-lg">😰</span>
                            <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">困难</span>
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onAction?.('srs_review', { cardIndex: index, quality: 4, card: currentCard });
                                next();
                            }}
                            className="flex flex-col items-center gap-1 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                        >
                            <span className="text-lg">🙂</span>
                            <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">记住</span>
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onAction?.('srs_review', { cardIndex: index, quality: 5, card: currentCard });
                                next();
                            }}
                            className="flex flex-col items-center gap-1 px-3 py-2 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg transition-colors"
                        >
                            <span className="text-lg">🤩</span>
                            <span className="text-xs text-green-600 dark:text-green-400 font-medium">简单</span>
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Save to Concepts Button */}
            <div className="flex items-center justify-center px-4">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onAction?.('save_concept', { card: currentCard });
                    }}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-500 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                >
                    <Save className="w-4 h-4" />
                    保存到我的笔记
                </button>
            </div>

            <div className="flex items-center justify-between px-4">
                <Button
                    variant="outline"
                    size="icon"
                    onClick={prev}
                    disabled={index === 0}
                    className="rounded-full w-12 h-12 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm"
                >
                    <ChevronLeft className="w-6 h-6" />
                </Button>

                <div className="flex flex-col items-center gap-1">
                    <span className="text-sm font-bold text-zinc-400">
                        {index + 1} <span className="text-zinc-300 dark:text-zinc-700 mx-1">/</span> {cards.length}
                    </span>
                    <div className="flex gap-1">
                        {cards.map((_, i) => (
                            <div key={i} className={cn("w-1 h-1 rounded-full transition-all", i === index ? "w-4 bg-blue-500" : "bg-zinc-200 dark:bg-zinc-800")} />
                        ))}
                    </div>
                </div>

                <Button
                    variant="outline"
                    size="icon"
                    onClick={next}
                    disabled={index === cards.length - 1}
                    className="rounded-full w-12 h-12 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm"
                >
                    <ChevronRight className="w-6 h-6" />
                </Button>
            </div>
        </div>
    );
};

// CSS for 3D card flip
import { cn } from '@/lib/utils';
