import { z } from 'zod';

// ==========================================
// Generative UI 2.0: Reactive Hyper-Schema
// ==========================================

// 1. Action Protocol: Defines how interactions mutate the state
export const ActionSchema = z.object({
  type: z.enum(['set', 'increment', 'decrement', 'toggle', 'push', 'run_code', 'emit']),
  path: z.string().optional().describe('State path to mutate (e.g., "state.score")'),
  value: z.any().optional().describe('Value to set or argument for the action'),
  target: z.string().optional().describe('Target ID for events (e.g., code editor ID)'),
});

export const TriggerSchema = z.record(
  z.string(),
  z.array(ActionSchema)
).describe('Map of event names (onClick, onChange) to list of actions');

// 2. Base Atoms

// Input Atoms (Reactive)
// "bind" prop is the key to reactivity. If bind="state.foo", 
// the component reads "state.foo" and writes back to it.
export const SliderAtomSchema = z.object({
  type: z.literal('slider'),
  bind: z.string().describe('State path to bind to (e.g., "state.variables.x")'),
  min: z.number().default(0),
  max: z.number().default(100),
  step: z.number().default(1),
  label: z.string().optional(),
});

export const SwitchAtomSchema = z.object({
  type: z.literal('switch'),
  bind: z.string(),
  label: z.string().optional(),
});

export const ButtonAtomSchema = z.object({
  type: z.literal('button'),
  label: z.string(),
  variant: z.enum(['default', 'outline', 'ghost', 'destructive']).default('default'),
  onClick: z.array(ActionSchema).optional(),
});

// Display Atoms
export const TextAtomSchema = z.object({
  type: z.literal('text'),
  content: z.string().describe('Markdown text. Supports interpolation like {{state.value}}'),
  variant: z.enum(['h1', 'h2', 'h3', 'p', 'muted']).default('p'),
  className: z.string().optional(),
});

export const CodeAtomSchema = z.object({
  type: z.literal('code'),
  id: z.string().optional(), // For targeting via actions
  language: z.string().default('javascript'),
  initialCode: z.string(),
  readOnly: z.boolean().default(false),
  runnable: z.boolean().default(true),
});

// Leaf Atoms Collection
const LeafAtoms = [
  SliderAtomSchema,
  SwitchAtomSchema,
  ButtonAtomSchema,
  TextAtomSchema,
  CodeAtomSchema,
] as const;

const LeafAtomSchema = z.discriminatedUnion('type', LeafAtoms);

// Level 1: Leaf + Containers(Leaf)
const StackAtomSchemaLevel1 = z.object({
  type: z.literal('stack'),
  direction: z.enum(['horizontal', 'vertical']).default('vertical'),
  gap: z.enum(['sm', 'md', 'lg']).default('md'),
  children: z.array(LeafAtomSchema),
  className: z.string().optional(),
});

const CardAtomSchemaLevel1 = z.object({
  type: z.literal('card'),
  title: z.string().optional(),
  children: z.array(LeafAtomSchema),
  className: z.string().optional(),
});

const AtomSchemaLevel1 = z.discriminatedUnion('type', [
  ...LeafAtoms,
  StackAtomSchemaLevel1,
  CardAtomSchemaLevel1
]);

// Level 2: Leaf + Containers(Level1)
const StackAtomSchemaLevel2 = z.object({
  type: z.literal('stack'),
  direction: z.enum(['horizontal', 'vertical']).default('vertical'),
  gap: z.enum(['sm', 'md', 'lg']).default('md'),
  children: z.array(AtomSchemaLevel1),
  className: z.string().optional(),
});

const CardAtomSchemaLevel2 = z.object({
  type: z.literal('card'),
  title: z.string().optional(),
  children: z.array(AtomSchemaLevel1),
  className: z.string().optional(),
});

const AtomSchemaLevel2 = z.discriminatedUnion('type', [
  ...LeafAtoms,
  StackAtomSchemaLevel2,
  CardAtomSchemaLevel2
]);

// Level 3 (Final): Leaf + Containers(Level2)
export const StackAtomSchema = z.object({
  type: z.literal('stack'),
  direction: z.enum(['horizontal', 'vertical']).default('vertical'),
  gap: z.enum(['sm', 'md', 'lg']).default('md'),
  children: z.array(AtomSchemaLevel2),
  className: z.string().optional(),
});

export const CardAtomSchema = z.object({
  type: z.literal('card'),
  title: z.string().optional(),
  children: z.array(AtomSchemaLevel2),
  className: z.string().optional(),
});

// Final Exported AtomSchema (Non-Recursive, Depth 3)
export const AtomSchema = z.discriminatedUnion('type', [
  ...LeafAtoms,
  StackAtomSchema,
  CardAtomSchema,
]);

// 3. The Root Container
// AI now generates a full mini-app, not just a component
export const GenerativeAppSchema = z.object({
  type: z.literal('app'),
  initialState: z.record(z.string(), z.any()).describe('Initial values for the reactive state tree'),
  layout: AtomSchema.describe('Root component of the UI tree'),
});

// Keep legacy schemas for backward compatibility during migration
export const LegacyExplanationSchema = z.object({
  type: z.literal('explanation'),
  title: z.string().optional(),
  content: z.string(),
  tone: z.string().optional(),
});

export const LegacyQuizSchema = z.object({
  type: z.literal('quiz'),
  question: z.string(),
  options: z.array(z.string()),
  correctIndex: z.number(),
  explanation: z.string(),
});

export const LegacyCodeSchema = z.object({
  type: z.literal('code'),
  language: z.string(),
  description: z.string(),
  starterCode: z.string(),
  solution: z.string(),
});

// Union of Old and New
export const UIComponentSchema = z.discriminatedUnion('type', [
  GenerativeAppSchema, // The new hotness
  LegacyExplanationSchema,
  LegacyQuizSchema,
  LegacyCodeSchema,
  // ... others can be deprecated
]);

export const SourceSchema = z.object({
  articleId: z.string(),
  title: z.string(),
  excerpt: z.string(),
  similarity: z.number(),
  domain: z.string().optional().nullable(),
});

export const LearningResponseSchema = z.object({
  reasoning: z.string().optional(),
  ui: UIComponentSchema,
  sources: z.array(SourceSchema).optional(),
  suggestedActions: z.array(z.object({
    label: z.string(),
    action: z.string(),
    type: z.enum(['primary', 'secondary', 'danger']).default('secondary')
  })).optional()
});

export type Atom = z.infer<typeof AtomSchema>;
export type Action = z.infer<typeof ActionSchema>;
export type GenerativeApp = z.infer<typeof GenerativeAppSchema>;
export type UIComponent = z.infer<typeof UIComponentSchema>;
export type LearningResponse = z.infer<typeof LearningResponseSchema>;
