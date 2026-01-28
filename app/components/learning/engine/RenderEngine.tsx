import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UIComponent } from '@/lib/core/learning/schemas';
import { TextAtom } from '../atoms/TextAtom';
import { OptionAtom } from '../atoms/OptionAtom';
import { ActionAtom } from '../atoms/ActionAtom';
import { CodeAtom } from '../atoms/CodeAtom';
import confetti from 'canvas-confetti';

interface RenderEngineProps {
  component: UIComponent;
  onAction: (action: string, value?: any) => void;
}

export const RenderEngine: React.FC<RenderEngineProps> = ({ component, onAction }) => {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Intent: Explain Concept
  if (component.type === 'explanation') {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="space-y-4 w-full max-w-2xl mx-auto"
      >
        {component.title && (
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
            {component.title}
          </h2>
        )}
        <TextAtom content={component.content} />
      </motion.div>
    );
  }

  // Intent: Verify Knowledge (Quiz)
  if (component.type === 'quiz') {
    const handleOptionClick = (index: number) => {
      if (isSubmitted) return;
      setSelectedOption(index);
      setIsSubmitted(true);
      
      const isCorrect = index === component.correctIndex;
      
      if (isCorrect) {
        // Trigger confetti
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      }

      // Delay action to allow user to see result animation
      setTimeout(() => {
        onAction(isCorrect ? 'quiz_correct' : 'quiz_incorrect', { 
            question: component.question, 
            answer: component.options[index] 
        });
      }, 2000);
    };

    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6 w-full max-w-xl mx-auto"
      >
        <motion.div 
            layout 
            className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-100 dark:border-zinc-800"
        >
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-6">
            {component.question}
          </h3>
          
          <div className="space-y-3">
            {component.options.map((option, idx) => (
              <OptionAtom
                key={idx}
                label={option}
                selected={selectedOption === idx}
                correct={isSubmitted ? (idx === component.correctIndex) : null}
                disabled={isSubmitted}
                onClick={() => handleOptionClick(idx)}
              />
            ))}
          </div>

          <AnimatePresence>
            {isSubmitted && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="overflow-hidden"
              >
                <div className="mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-800">
                    <TextAtom 
                        variant="muted" 
                        content={`**Explanation:** ${component.explanation}`} 
                    />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    );
  }

  // Intent: Coding Practice
  if (component.type === 'code') {
     return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-3xl mx-auto space-y-4"
        >
             <div className="p-4 bg-zinc-100 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700">
                <TextAtom variant="normal" content={component.description} />
            </div>

            <CodeAtom 
                initialCode={component.starterCode}
                language={component.language}
                onRun={(code, output, isError) => {
                    if (!isError && output && !output.includes('Error')) {
                        // If code runs successfully, maybe give them a "Submit" button or auto-advance?
                        // For now, we just let them play. 
                        // To submit, we can add a explicit submit action button below.
                        onAction('code_run', { code, output, isError });
                    }
                }}
            />
        </motion.div>
     )
  }

  return (
    <div className="p-4 text-center text-zinc-500">
      Unknown component type: {component.type}
    </div>
  );
};
