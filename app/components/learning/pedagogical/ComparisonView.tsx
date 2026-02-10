import React from 'react';
import { motion } from 'framer-motion';
import { Comparison } from '@/lib/core/learning/schemas';
import { cn } from '@/lib/utils';
import { Scale, Check, X } from 'lucide-react';

interface ComparisonViewProps {
    data: Comparison;
}

export const ComparisonView: React.FC<ComparisonViewProps> = ({ data }) => {
    return (
        <div className="w-full max-w-4xl mx-auto py-6">
            <div className="flex items-center gap-3 mb-8 justify-center">
                <Scale className="w-6 h-6 text-blue-500" />
                <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 to-zinc-500 dark:from-zinc-100 dark:to-zinc-500">
                    {data.title}
                </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-px bg-zinc-200 dark:bg-zinc-800 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-xl">
                {data.columns.map((column, colIdx) => (
                    <motion.div
                        key={column.header}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: colIdx * 0.1 }}
                        className="bg-white dark:bg-zinc-900 flex flex-col"
                    >
                        <div className={cn(
                            "p-6 text-center font-bold border-b border-zinc-100 dark:border-zinc-800",
                            colIdx === 0 ? "bg-blue-50/50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400" :
                                colIdx === 1 ? "bg-purple-50/50 dark:bg-purple-900/10 text-purple-600 dark:text-purple-400" :
                                    "text-zinc-900 dark:text-zinc-100"
                        )}>
                            {column.header}
                        </div>

                        <div className="flex-1 divide-y divide-zinc-50 dark:divide-zinc-800/50">
                            {column.items.map((item, itemIdx) => (
                                <div
                                    key={itemIdx}
                                    className="p-6 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors flex items-start gap-3"
                                >
                                    <div className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                                    <span className="leading-relaxed">{item}</span>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                ))}
            </div>

            {data.highlightDifferences && (
                <p className="text-center mt-6 text-xs text-zinc-400 font-medium italic opacity-70">
                    💡 亮点标注已启用：您可以重点关注各列之间的对应差异。
                </p>
            )}
        </div>
    );
};
