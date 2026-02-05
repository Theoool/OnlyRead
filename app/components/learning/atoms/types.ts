import { Atom } from '@/lib/core/learning/schemas';

export interface AtomProps {
  atom: Atom;
  state: Record<string, any>;
  updateState: (path: string, value: any) => void;
  onAction: (trigger: string, value?: any) => void;
}
