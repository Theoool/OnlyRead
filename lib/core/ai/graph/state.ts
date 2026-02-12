import { BaseMessage } from '@langchain/core/messages';
import { LearningResponse } from '@/lib/core/learning/schemas';

/**
 * Source metadata for citation
 */
export interface Source {
  articleId: string;
  title: string;
  excerpt: string;
  similarity: number;
  domain?: string | null;
}

export interface RetrievalPolicy {
  enabled: boolean;
  mode: 'fast' | 'comprehensive';
  topK: number;
  minSimilarity: number;
  minSources: number;
  rewriteQuery: boolean;
  confidence: number;
  reason: string;
}

/**
 * State Definition for the Unified AI Graph
 */
export interface IGraphState {
  messages: BaseMessage[];
  userMessage: string;
  userId: string;

  // RAG Filters
  articleIds: string[];
  collectionId?: string;

  // Learning Context
  currentTopic?: string;
  masteryLevel: number;

  // NEW: Mode and Context
  mode: 'qa' | 'tutor' | 'copilot';
  context?: {
    selection?: string;
    currentContent?: string;
  };

  retrievalMode?: 'none' | 'fast' | 'comprehensive';
  retrievalQuery?: string;
  retrievalTopK?: number;
  retrievalPolicy?: RetrievalPolicy;

  // Pedagogical UI Strategy (Phase 2)
  learningMode?: 'macro' | 'micro';
  uiIntent?: 'text' | 'explanation' | 'mindmap' | 'flashcard' | 'quiz' | 'fill_blank' | 'timeline' | 'comparison' | 'simulation' | 'code_sandbox' | 'summary';
  userConcepts?: string[];

  // Internal Processing
  documents: string;
  sources: Source[];
  nextStep?: string;
  reasoning?: string;
  finalResponse?: LearningResponse;
}

export type UIIntent = 'text' | 'explanation' | 'mindmap' | 'flashcard' | 'quiz' | 'fill_blank' | 'timeline' | 'comparison' | 'simulation' | 'code_sandbox' | 'summary';

export const GraphState = {
  // Conversation History
  messages: {
    value: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
    default: () => [],
  },

  // User Input
  userMessage: {
    value: (x: string, y: string) => y,
    default: () => "",
  },
  userId: {
    value: (x: string, y: string) => y,
    default: () => "",
  },

  // Filters
  articleIds: {
    value: (x: string[], y: string[]) => y,
    default: () => [] as string[],
  },
  collectionId: {
    value: (x: string | undefined, y: string | undefined) => y,
    default: () => undefined,
  },

  // Learning Context
  currentTopic: {
    value: (x: string | undefined, y: string | undefined) => y,
    default: () => undefined,
  },
  masteryLevel: {
    value: (x: number, y: number) => y,
    default: () => 0,
  },

  // NEW: Mode and Context
  mode: {
    value: (x: any, y: any) => y ?? x,
    default: () => 'tutor',
  },
  context: {
    value: (x: any, y: any) => y ?? x,
    default: () => undefined,
  },

  retrievalMode: {
    value: (x: any, y: any) => y ?? x,
    default: () => undefined,
  },
  retrievalQuery: {
    value: (x: any, y: any) => y ?? x,
    default: () => undefined,
  },
  retrievalTopK: {
    value: (x: any, y: any) => y ?? x,
    default: () => undefined,
  },
  retrievalPolicy: {
    value: (x: any, y: any) => y ?? x,
    default: () => undefined,
  },

  // Internal
  documents: {
    value: (x: string, y: string) => y,
    default: () => "",
  },
  sources: {
    value: (x: Source[], y: Source[]) => y ?? x,
    default: () => [] as Source[],
  },

  // Decision Output
  nextStep: {
    value: (x: string | undefined, y: string | undefined) => y,
    default: () => undefined,
  },
  reasoning: {
    value: (x: string | undefined, y: string | undefined) => y,
    default: () => undefined,
  },

  // Final Output Payload
  finalResponse: {
    value: (x: LearningResponse | undefined, y: LearningResponse | undefined) => y,
    default: () => undefined,
  },

  // Pedagogical UI Strategy (Phase 2)
  learningMode: {
    value: (x: 'macro' | 'micro' | undefined, y: 'macro' | 'micro' | undefined) => y ?? x ?? 'micro',
    default: () => 'micro' as 'macro' | 'micro',
  },
  uiIntent: {
    value: (x: string | undefined, y: string | undefined) => y ?? x ?? 'text',
    default: () => 'text' as string,
  },
  userConcepts: {
    value: (x: string[] | undefined, y: string[] | undefined) => y ?? x ?? [],
    default: () => [] as string[],
  },
};
