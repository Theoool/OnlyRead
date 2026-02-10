import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { InteractiveQuiz } from '@/lib/core/learning/schemas';
import { Card } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { CheckCircle2, XCircle, Info, ChevronRight, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';

interface InteractiveQuizViewProps {
    data: InteractiveQuiz;
    onAction?: (action: string, value?: any) => void;
}

export const InteractiveQuizView: React.FC<InteractiveQuizViewProps> = ({ data, onAction }) => {
    const [currentIdx, setCurrentIdx] = useState(0);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [showExplanation, setShowExplanation] = useState(false);
    const [score, setScore] = useState(0);
    const [isFinished, setIsFinished] = useState(false);

    const question = data.questions[currentIdx];

    const handleSelect = (optionId: string, isCorrect: boolean) => {
        if (selectedId) return;

        setSelectedId(optionId);
        setShowExplanation(true);

        if (isCorrect) {
            setScore(s => s + 1);
            confetti({
                particleCount: 50,
                spread: 60,
                origin: { y: 0.7 }
            });
        }
    };

    const handleNext = () => {
        if (currentIdx < data.questions.length - 1) {
            setCurrentIdx(currentIdx + 1);
            setSelectedId(null);
            setShowExplanation(false);
        } else {
            setIsFinished(true);
            onAction?.('quiz_finished', { score, total: data.questions.length });
        }
    };

    if (isFinished) {
        return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12 space-y-6">
                <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="text-2xl font-bold">测验完成！</h3>
                <p className="text-zinc-500">得分：{score} / {data.questions.length}</p>
                <Button onClick={() => onAction?.('restart_quiz')} className="mt-4">
                    重新开始
                </Button>
            </motion.div>
        );
    }

    return (
        <div className="w-full max-w-xl mx-auto space-y-6">
            <div className="flex justify-between items-center mb-4">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                    问题 {currentIdx + 1} / {data.questions.length}
                </span>
                <div className="flex gap-1">
                    {data.questions.map((_, i) => (
                        <div key={i} className={cn("h-1 rounded-full transition-all duration-300",
                            i < currentIdx ? "w-4 bg-emerald-500" :
                                i === currentIdx ? "w-6 bg-blue-500" : "w-2 bg-zinc-200 dark:bg-zinc-800"
                        )} />
                    ))}
                </div>
            </div>

            <motion.div
                key={currentIdx}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
            >
                <h3 className="text-xl font-bold leading-tight text-zinc-900 dark:text-zinc-100">
                    {question.question}
                </h3>

                <div className="grid gap-3">
                    {question.options.map((option) => {
                        const isSelected = selectedId === option.id;
                        const isCorrect = option.isCorrect;
                        const showCorrect = selectedId && isCorrect;
                        const showIncorrect = isSelected && !isCorrect;

                        return (
                            <button
                                key={option.id}
                                disabled={!!selectedId}
                                onClick={() => handleSelect(option.id, isCorrect)}
                                className={cn(
                                    "relative w-full text-left p-5 rounded-2xl border-2 transition-all duration-200 group",
                                    !selectedId && "bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 hover:border-blue-500 hover:shadow-md",
                                    showCorrect && "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500 text-emerald-900 dark:text-emerald-100 shadow-[0_0_15px_rgba(16,185,129,0.2)]",
                                    showIncorrect && "bg-rose-50 dark:bg-rose-950/30 border-rose-500 text-rose-900 dark:text-rose-100"
                                )}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={cn(
                                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors",
                                        !selectedId && "border-zinc-200 dark:border-zinc-700 group-hover:border-blue-500",
                                        showCorrect && "bg-emerald-500 border-emerald-500 text-white",
                                        showIncorrect && "bg-rose-500 border-rose-500 text-white"
                                    )}>
                                        {showCorrect ? <CheckCircle2 className="w-5 h-5" /> :
                                            showIncorrect ? <XCircle className="w-5 h-5" /> :
                                                <HelpCircle className="w-5 h-5 opacity-40 group-hover:opacity-100 transition-opacity" />}
                                    </div>
                                    <span className="font-medium">{option.text}</span>
                                </div>
                            </button>
                        );
                    })}
                </div>

                <AnimatePresence>
                    {showExplanation && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="overflow-hidden"
                        >
                            <div className="p-6 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-700/50 space-y-3">
                                <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-xs font-bold uppercase tracking-wider">
                                    <Info className="w-4 h-4" /> 解析
                                </div>
                                <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                                    {question.explanation}
                                </p>
                                <Button onClick={handleNext} className="w-full mt-4 flex items-center justify-center gap-2">
                                    {currentIdx === data.questions.length - 1 ? "查看结果" : "下一题"}
                                    <ChevronRight className="w-4 h-4" />
                                </Button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
};
