import React from 'react';
import { motion } from 'framer-motion';

interface OptionAtomProps {
  label: string;
  selected?: boolean;
  correct?: boolean | null; // null means not yet validated
  disabled?: boolean;
  onClick: () => void;
}

export const OptionAtom: React.FC<OptionAtomProps> = ({ label, selected, correct, disabled, onClick }) => {
  let statusColor = "border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50";
  
  if (selected) {
    if (correct === true) statusColor = "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300";
    else if (correct === false) statusColor = "border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300";
    else statusColor = "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300";
  } else if (correct === true && disabled) {
     // Show correct answer even if not selected when disabled
     statusColor = "border-green-500 bg-green-50/50 dark:bg-green-900/10 text-green-700/70 dark:text-green-300/70";
  }

  return (
    <motion.button
      whileHover={!disabled ? { scale: 1.01 } : {}}
      whileTap={!disabled ? { scale: 0.99 } : {}}
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${statusColor} ${disabled ? 'cursor-default' : 'cursor-pointer'}`}
    >
      <div className="flex items-center justify-between">
        <span className="font-medium">{label}</span>
        {selected && correct === true && <span className="text-green-600">✓</span>}
        {selected && correct === false && <span className="text-red-600">✕</span>}
      </div>
    </motion.button>
  );
};
