import React from 'react';
import { motion } from 'framer-motion';
import { Timeline } from '@/lib/core/learning/schemas';
import { Card } from '@/app/components/ui/card';
import { cn } from '@/lib/utils';
import { Clock, Calendar, CheckCircle2 } from 'lucide-react';

interface TimelineViewProps {
    data: Timeline;
    onAction?: (action: string, value?: any) => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({ data }) => {
    return (
        <div className="w-full max-w-2xl mx-auto py-8">
            <h3 className="text-xl font-bold text-center mb-12 bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 to-zinc-500 dark:from-zinc-100 dark:to-zinc-500">
                {data.title}
            </h3>

            <div className="relative space-y-8">
                {/* The vertical line */}
                <div className="absolute left-[27px] top-4 bottom-4 w-0.5 bg-gradient-to-b from-blue-500/50 via-purple-500/50 to-transparent dark:from-blue-500/30 dark:via-purple-500/30 hidden sm:block" />

                {data.events.map((event, i) => (
                    <motion.div
                        key={event.id}
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.1 }}
                        className="relative flex items-start gap-6 group"
                    >
                        {/* Timeline node */}
                        <div className="z-10 mt-1.5 shrink-0 hidden sm:flex items-center justify-center w-14 h-14 rounded-2xl bg-white dark:bg-zinc-900 border-2 border-zinc-100 dark:border-zinc-800 shadow-sm group-hover:border-blue-500 group-hover:shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-all duration-500">
                            <Clock className="w-5 h-5 text-blue-500" />
                        </div>

                        <Card className="flex-1 p-6 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm border-zinc-100 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow group-hover:bg-white dark:group-hover:bg-zinc-900">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-wider">
                                    <Calendar className="w-3 h-3" /> {event.date || `阶段 ${i + 1}`}
                                </span>
                                <CheckCircle2 className="w-4 h-4 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>

                            <h4 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">
                                {event.label}
                            </h4>
                            <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed text-sm">
                                {event.description}
                            </p>
                        </Card>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};
