import React from 'react';
import { Slider } from '@/app/components/ui/slider';
import { AtomProps } from './types';

// Simple helper to get value from state path
const getValue = (obj: any, path: string) => {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
};

export const ReactiveSlider: React.FC<AtomProps> = ({ atom, state, updateState }) => {
  if (atom.type !== 'slider') return null;

  // Parse "state.foo.bar" -> "foo.bar"
  const path = atom.bind.replace(/^state\./, '');
  const value = getValue(state, path) ?? atom.min;

  const handleChange = (vals: number[]) => {
    updateState(path, vals[0]);
  };

  return (
    <div className="space-y-2 w-full">
        {atom.label && (
            <div className="flex justify-between text-sm">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">{atom.label}</span>
                <span className="text-zinc-500">{value}</span>
            </div>
        )}
        <Slider
            value={[value]}
            min={atom.min}
            max={atom.max}
            step={atom.step}
            onValueChange={handleChange}
        />
    </div>
  );
};
