import React from 'react';
import { AtomProps } from './types';
import { Switch } from '@/app/components/ui/switch';

// Simple helper to get value from state path
const getValue = (obj: any, path: string) => {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
};

export const ReactiveSwitch: React.FC<AtomProps> = ({ atom, state, updateState }) => {
    if (atom.type !== 'switch') return null;

    const path = atom.bind.replace(/^state\./, '');
    const checked = getValue(state, path) ?? false;

    const handleCheckedChange = (checked: boolean) => {
        updateState(path, checked);
    };

    return (
        <div className="flex items-center justify-between space-x-2">
            {atom.label && (
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-zinc-700 dark:text-zinc-300">
                    {atom.label}
                </label>
            )}
            <Switch
                checked={checked}
                onCheckedChange={handleCheckedChange}
            />
        </div>
    );
};
