import React from 'react';
import { motion } from 'framer-motion';
import { Summary } from '@/lib/core/learning/schemas';
import { Card, CardHeader, CardTitle, CardContent } from '@/app/components/ui/card';
import { CheckCircle2, ArrowRight, Lightbulb, Target } from 'lucide-react';

interface SummaryViewProps {
    data: Summary;
    onAction?: (action: string) => void;
}

export const SummaryView: React.FC<SummaryViewProps> = ({ data, onAction }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-2xl mx-auto space-y-4"
        >
            <Card className="border-none shadow-lg bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm overflow-hidden">
                <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
                <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 to-zinc-600 dark:from-zinc-100 dark:to-zinc-400">
                        {data.title}
                    </CardTitle>
                    <p className="text-zinc-500 dark:text-zinc-400 font-medium">
                        {data.overview}
                    </p>
                </CardHeader>
                <CardContent className="space-y-6 pt-4">
                    <div className="grid gap-3">
                        {data.keyPoints.map((point, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.1 }}
                                className="flex items-start gap-3 p-3 rounded-xl bg-zinc-50/50 dark:bg-zinc-800/30 border border-zinc-100/50 dark:border-zinc-700/30 group hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                            >
                                <span className="text-xl shrink-0 group-hover:scale-110 transition-transform">
                                    {point.emoji || '✨'}
                                </span>
                                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                                    {point.point}
                                </p>
                            </motion.div>
                        ))}
                    </div>

                    {data.nextSteps && data.nextSteps.length > 0 && (
                        <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                                <Target className="w-4 h-4" /> 下一阶段路线
                            </h4>
                            <div className="space-y-2">
                                {data.nextSteps.map((step, i) => (
                                    <div key={i} className="flex items-center gap-3 p-2 group hover:translate-x-1 transition-transform cursor-pointer" onClick={() => onAction?.(`step_${i}`)}>
                                        <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 text-xs font-bold shrink-0">
                                            {i + 1}
                                        </div>
                                        <span className="text-zinc-600 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors">
                                            {step}
                                        </span>
                                        <ArrowRight className="w-4 h-4 ml-auto opacity-0 group-hover:opacity-100 text-blue-500 transition-opacity" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </motion.div>
    );
};
