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

// ==========================================
// 4. Pedagogical UI Intent System
// ==========================================
// These define the "intent" behind the UI, guiding what type of component to generate

export const UIIntentEnum = z.enum([
  'text',           // Pure text/markdown explanation
  'mindmap',        // Concept map / knowledge graph visualization
  'flashcard',      // Concept memory cards (front/back)
  'quiz',           // Multiple choice / true-false questions
  'fill_blank',     // Fill-in-the-blank active recall
  'timeline',       // Chronological sequence visualization
  'comparison',     // Side-by-side A vs B table
  'simulation',     // Interactive simulation with sliders/variables
  'code_sandbox',   // Runnable code editor with exercises
  'summary',        // Structured summary with key points
]);

export type UIIntent = z.infer<typeof UIIntentEnum>;

// ==========================================
// 5. High-Level Pedagogical Component Schemas
// ==========================================
// These are semantic schemas that AI can generate, 
// which the frontend will render with rich visuals

// Mindmap Node for hierarchical concept visualization
export const MindmapNodeSchema: z.ZodType<any> = z.lazy(() => z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
  children: z.array(MindmapNodeSchema).optional(),
  style: z.enum(['primary', 'secondary', 'accent']).optional(),
}));

export const MindmapSchema = z.object({
  type: z.literal('mindmap'),
  title: z.string(),
  rootNode: MindmapNodeSchema,
  focusNodeId: z.string().optional().describe('Which node is currently being discussed'),
});

// Flashcard for spaced repetition
export const FlashcardSchema = z.object({
  type: z.literal('flashcard'),
  cards: z.array(z.object({
    id: z.string(),
    front: z.string().describe('Question or term'),
    back: z.string().describe('Answer or definition'),
    hint: z.string().optional(),
    difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  })),
  currentIndex: z.number().default(0),
});

// Timeline for historical/process visualization  
export const TimelineSchema = z.object({
  type: z.literal('timeline'),
  title: z.string(),
  events: z.array(z.object({
    id: z.string(),
    date: z.string().optional(),
    label: z.string(),
    description: z.string(),
    icon: z.string().optional(),
  })),
  direction: z.enum(['horizontal', 'vertical']).default('vertical'),
});

// Comparison table for A vs B analysis
export const ComparisonSchema = z.object({
  type: z.literal('comparison'),
  title: z.string(),
  columns: z.array(z.object({
    header: z.string(),
    items: z.array(z.string()),
  })).min(2).max(4),
  highlightDifferences: z.boolean().default(true),
});

// Summary with key takeaways
export const SummarySchema = z.object({
  type: z.literal('summary'),
  title: z.string(),
  overview: z.string().describe('1-2 sentence overview'),
  keyPoints: z.array(z.object({
    emoji: z.string().optional(),
    point: z.string(),
  })),
  nextSteps: z.array(z.string()).optional(),
});

// Interactive Quiz with immediate feedback
export const InteractiveQuizSchema = z.object({
  type: z.literal('interactive_quiz'),
  questions: z.array(z.object({
    id: z.string(),
    question: z.string(),
    options: z.array(z.object({
      id: z.string(),
      text: z.string(),
      isCorrect: z.boolean(),
    })),
    explanation: z.string(),
    hint: z.string().optional(),
  })),
  showExplanationOnWrong: z.boolean().default(true),
});

// Fill in the blank for active recall
export const FillBlankSchema = z.object({
  type: z.literal('fill_blank'),
  sentences: z.array(z.object({
    id: z.string(),
    text: z.string().describe('Use {{blank}} to mark blanks'),
    answers: z.array(z.string()).describe('Acceptable answers for the blank'),
    hint: z.string().optional(),
  })),
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

// Union of Old and New (Extended with Pedagogical UI)
export const UIComponentSchema = z.discriminatedUnion('type', [
  GenerativeAppSchema,      // Full reactive app
  LegacyExplanationSchema,  // Simple text
  LegacyQuizSchema,         // Legacy quiz format
  LegacyCodeSchema,         // Legacy code format
  // New Pedagogical UI Components
  MindmapSchema,            // Concept visualization
  FlashcardSchema,          // Memory cards
  TimelineSchema,           // Chronological view
  ComparisonSchema,         // A vs B analysis
  SummarySchema,            // Structured summary
  InteractiveQuizSchema,    // Enhanced quiz
  FillBlankSchema,          // Active recall
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

// New Pedagogical Types
export type Mindmap = z.infer<typeof MindmapSchema>;
export type MindmapNode = z.infer<typeof MindmapNodeSchema>;
export type Flashcard = z.infer<typeof FlashcardSchema>;
export type Timeline = z.infer<typeof TimelineSchema>;
export type Comparison = z.infer<typeof ComparisonSchema>;
export type Summary = z.infer<typeof SummarySchema>;
export type InteractiveQuiz = z.infer<typeof InteractiveQuizSchema>;
export type FillBlank = z.infer<typeof FillBlankSchema>;
