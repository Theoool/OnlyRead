import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UIComponent, Atom, GenerativeApp } from '@/lib/core/learning/schemas';
import { TextAtom } from '../atoms/TextAtom';
import { OptionAtom } from '../atoms/OptionAtom';
import { CodeAtom } from '../atoms/CodeAtom';
import confetti from 'canvas-confetti';

// Reactive Atoms
import { ReactiveSlider } from '../atoms/ReactiveSlider';
import { ReactiveText } from '../atoms/ReactiveText';
import { ReactiveButton } from '../atoms/ReactiveButton';
import { ReactiveSwitch } from '../atoms/ReactiveSwitch';
import { Card, CardHeader, CardTitle, CardContent } from '@/app/components/ui/card';
import { cn } from '@/lib/utils';

interface RenderEngineProps {
  component: UIComponent;
  onAction: (action: string, value?: any) => void;
}

// ==========================================
// Recursive Atom Renderer
// ==========================================
interface AtomRendererProps {
  atom: any;
  state: Record<string, any>;
  updateState: (path: string, value: any) => void;
  onAction: (action: string, value?: any) => void;
}

const AtomRenderer: React.FC<AtomRendererProps> = ({ atom, state, updateState, onAction }) => {
  switch (atom.type) {
    case 'stack':
      return (
        <div className={cn(
          "flex",
          atom.direction === 'vertical' ? 'flex-col' : 'flex-row flex-wrap items-center',
          atom.gap === 'sm' && 'gap-2',
          atom.gap === 'md' && 'gap-4',
          atom.gap === 'lg' && 'gap-6',
          atom.className
        )}>
          {atom.children.map((child: any, i: number) => (
            <AtomRenderer key={i} atom={child} state={state} updateState={updateState} onAction={onAction} />
          ))}
        </div>
      );
    case 'card':
      return (
        <Card className={cn("overflow-hidden border-zinc-200 dark:border-zinc-800 shadow-sm", atom.className)}>
          {atom.title && (
            <CardHeader className="bg-zinc-50/50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-800 pb-4">
              <CardTitle className="text-base font-medium">{atom.title}</CardTitle>
            </CardHeader>
          )}
          <CardContent className={cn("p-6", atom.title && "pt-6")}>
            {atom.children.map((child: any, i: number) => (
              <AtomRenderer key={i} atom={child} state={state} updateState={updateState} onAction={onAction} />
            ))}
          </CardContent>
        </Card>
      );
    case 'slider':
      return <ReactiveSlider atom={atom} state={state} updateState={updateState} onAction={onAction} />;
    case 'text':
      return <ReactiveText atom={atom} state={state} updateState={updateState} onAction={onAction} />;
    case 'button':
      return <ReactiveButton atom={atom} state={state} updateState={updateState} onAction={onAction} />;
    case 'switch':
      return <ReactiveSwitch atom={atom} state={state} updateState={updateState} onAction={onAction} />;
    case 'code':
      return <CodeAtom initialCode={atom.initialCode} language={atom.language} onRun={() => { }} />;
    default:
      return <div className="text-red-500 text-xs">Unknown Atom: {(atom as any).type}</div>;
  }
};

// ==========================================
// Main Engine
// ==========================================
export const RenderEngine: React.FC<RenderEngineProps> = ({ component, onAction }) => {
  // Use React state for generative app state (replaces Valtio proxy)
  const [appState, setAppState] = useState<Record<string, any>>(() =>
    component.type === 'app' ? { ...component.initialState } : {}
  );
  const stateRef = useRef(appState);

  // Keep stateRef in sync
  useEffect(() => {
    stateRef.current = appState;
  }, [appState]);

  // Legacy State for backward compatibility
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Handle state updates from atoms
  const updateState = useCallback((path: string, value: any) => {
    setAppState(prev => {
      const newState = { ...prev };
      const parts = path.split('.');
      let target: any = newState;
      for (let i = 0; i < parts.length - 1; i++) {
        target[parts[i]] = { ...target[parts[i]] };
        target = target[parts[i]];
      }
      target[parts[parts.length - 1]] = value;
      return newState;
    });
  }, []);

  // Handle Action Bus
  const handleAtomAction = (trigger: string, value?: any) => {
    if (trigger === 'submit_success') {
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      onAction('app_finished', stateRef.current);
    } else {
      onAction(trigger, value);
    }
  };

  // 1. Generative App Mode
  if (component.type === 'app') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-4xl mx-auto"
      >
        <AtomRenderer
          atom={component.layout}
          state={appState}
          updateState={updateState}
          onAction={handleAtomAction}
        />
      </motion.div>
    );
  }

  // 2. Legacy Modes (Backward Compatibility)

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
      Unknown component type: {(component as any).type}
    </div>
  );
};
