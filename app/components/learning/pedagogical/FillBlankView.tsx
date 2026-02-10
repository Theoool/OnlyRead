'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FillBlank } from '@/lib/core/learning/schemas';
import { Button } from '@/app/components/ui/button';
import { Check, X, Lightbulb } from 'lucide-react';
import confetti from 'canvas-confetti';

interface FillBlankViewProps {
  data: FillBlank;
  onAction?: (action: string, value?: any) => void;
}

interface BlankState {
  value: string;
  isCorrect: boolean | null;
  showHint: boolean;
}

export const FillBlankView: React.FC<FillBlankViewProps> = ({ data, onAction }) => {
  const [answers, setAnswers] = useState<BlankState[]>(
    data.sentences.map(() => ({ value: '', isCorrect: null, showHint: false }))
  );
  const [isComplete, setIsComplete] = useState(false);

  const handleInputChange = useCallback((index: number, value: string) => {
    setAnswers(prev => prev.map((ans, i) => 
      i === index ? { ...ans, value, isCorrect: null } : ans
    ));
  }, []);

  const checkAnswer = useCallback((index: number) => {
    const sentence = data.sentences[index];
    const userAnswer = answers[index].value.trim().toLowerCase();
    const correctAnswers = sentence.answers.map(a => a.toLowerCase());
    
    const isCorrect = correctAnswers.includes(userAnswer);
    
    setAnswers(prev => prev.map((ans, i) => 
      i === index ? { ...ans, isCorrect } : ans
    ));

    if (isCorrect) {
      // Check if all blanks are now correct
      const allCorrect = answers.every((ans, i) => 
        i === index ? true : ans.isCorrect === true
      );
      
      if (allCorrect && !isComplete) {
        setIsComplete(true);
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        onAction?.('fill_blank_done', { 
          sentences: data.sentences.length,
          correct: answers.filter(a => a.isCorrect === true).length + 1
        });
      }
    }
  }, [answers, data.sentences, isComplete, onAction]);

  const showHint = useCallback((index: number) => {
    setAnswers(prev => prev.map((ans, i) => 
      i === index ? { ...ans, showHint: true } : ans
    ));
  }, []);

  const renderSentence = (sentence: typeof data.sentences[0], index: number) => {
    const parts = sentence.text.split(/(\{\{blank\}\})/);
    const state = answers[index];

    return (
      <motion.div
        key={sentence.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1 }}
        className="space-y-3"
      >
        <div className="text-base leading-relaxed text-zinc-800 dark:text-zinc-200">
          {parts.map((part, partIndex) => {
            if (part === '{{blank}}') {
              return (
                <span key={partIndex} className="inline-block mx-1">
                  <input
                    type="text"
                    value={state.value}
                    onChange={(e) => handleInputChange(index, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        checkAnswer(index);
                      }
                    }}
                    disabled={state.isCorrect === true}
                    className={`inline-block w-32 px-2 py-1 text-center rounded border-2 transition-all ${
                      state.isCorrect === true
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                        : state.isCorrect === false
                        ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                        : 'border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 focus:border-indigo-500'
                    }`}
                    placeholder="?"
                  />
                  {state.isCorrect === true && (
                    <Check className="inline-block w-4 h-4 ml-1 text-green-500" />
                  )}
                  {state.isCorrect === false && (
                    <X className="inline-block w-4 h-4 ml-1 text-red-500" />
                  )}
                </span>
              );
            }
            return <span key={partIndex}>{part}</span>;
          })}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => checkAnswer(index)}
            disabled={!state.value.trim() || state.isCorrect === true}
            className="text-xs"
          >
            检查
          </Button>
          
          {sentence.hint && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => showHint(index)}
              disabled={state.showHint}
              className="text-xs text-zinc-500"
            >
              <Lightbulb className="w-3 h-3 mr-1" />
              提示
            </Button>
          )}
        </div>

        {/* Hint */}
        <AnimatePresence>
          {state.showHint && sentence.hint && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg"
            >
              💡 提示: {sentence.hint}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Correct Answer (shown after wrong attempt) */}
        <AnimatePresence>
          {state.isCorrect === false && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="text-sm text-zinc-600 dark:text-zinc-400"
            >
              正确答案: <span className="font-medium text-green-600 dark:text-green-400">{sentence.answers[0]}</span>
              {sentence.answers.length > 1 && (
                <span className="text-zinc-400"> (或: {sentence.answers.slice(1).join(', ')})</span>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Progress */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-500">
          进度: {answers.filter(a => a.isCorrect === true).length} / {data.sentences.length}
        </span>
        <div className="flex gap-1">
          {data.sentences.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                answers[i].isCorrect === true
                  ? 'bg-green-500'
                  : answers[i].isCorrect === false
                  ? 'bg-red-400'
                  : 'bg-zinc-200 dark:bg-zinc-700'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Sentences */}
      <div className="space-y-6">
        {data.sentences.map((sentence, index) => renderSentence(sentence, index))}
      </div>

      {/* Completion Message */}
      <AnimatePresence>
        {isComplete && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-6"
          >
            <div className="text-2xl mb-2">🎉</div>
            <p className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
              太棒了！全部完成！
            </p>
            <p className="text-sm text-zinc-500 mt-1">
              你已完成所有填空练习
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
