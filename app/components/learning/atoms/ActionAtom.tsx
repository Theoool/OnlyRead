import React from 'react';
import { motion } from 'framer-motion';

interface ActionAtomProps {
  label: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  onClick: () => void;
  icon?: React.ReactNode;
}

export const ActionAtom: React.FC<ActionAtomProps> = ({ label, variant = 'secondary', onClick, icon }) => {
  const variants = {
    primary: "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-sm",
    secondary: "bg-white text-zinc-900 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700",
    ghost: "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800"
  };

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 transition-colors ${variants[variant]}`}
    >
      {icon}
      {label}
    </motion.button>
  );
};
