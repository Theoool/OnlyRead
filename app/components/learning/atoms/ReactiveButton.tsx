import React from 'react';
import { AtomProps } from './types';
import { Button } from '@/app/components/ui/button';
import { motion } from 'framer-motion';

export const ReactiveButton: React.FC<AtomProps> = ({ atom, state, updateState, onAction }) => {
  if (atom.type !== 'button') return null;

  const handleClick = () => {
    if (atom.onClick) {
        // Execute local state mutations
        atom.onClick.forEach((action: any) => {
            if (action.type === 'set' && action.path) {
                const path = action.path.replace(/^state\./, '');
                updateState(path, action.value);
            } else if (action.type === 'increment' && action.path) {
                const path = action.path.replace(/^state\./, '');
                const parts = path.split('.');
                let target: any = state;
                for (const part of parts.slice(0, -1)) {
                    target = target?.[part];
                }
                const last = parts[parts.length - 1];
                const current = target?.[last] ?? 0;
                updateState(path, current + (action.value || 1));
            } else if (action.type === 'emit') {
                // Bubble up to parent engine
                onAction(action.value, state);
            }
        });
    }
  };

  return (
    <motion.div whileTap={{ scale: 0.95 }} className="inline-block">
        <Button 
            variant={atom.variant} 
            onClick={handleClick}
            className="w-full sm:w-auto font-medium transition-all active:scale-95"
        >
            {atom.label}
        </Button>
    </motion.div>
  );
};
