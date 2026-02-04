import { z } from 'zod';
import { BaseMessage } from '@langchain/core/messages';
import { LearningResponse } from '../schemas';

/**
 * Source metadata for citation
 */
export interface Source {
  articleId: string;
  title: string;
  excerpt: string;
  similarity: number;
}

/**
 * State Definition for the Learning Graph
 */
export interface ILearningGraphState {
  messages: BaseMessage[];
  userMessage: string;
  userId: string;
  articleIds: string[];
  collectionId?: string;
  currentTopic?: string;
  masteryLevel: number;
  documents: string;
  sources: Source[];
  nextStep?: string;
  reasoning?: string;
  finalResponse?: LearningResponse;
}
export const LearningGraphState = {
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
    // Supports multi-document selection
    articleIds: {
      value: (x: string[], y: string[]) => y,
      default: () => [] as string[],
    },
    collectionId: {
      value: (x: string | undefined, y: string | undefined) => y,
      default: () => undefined,
    },
    
    // Context
    currentTopic: {
      value: (x: string | undefined, y: string | undefined) => y,
      default: () => undefined,
    },
    masteryLevel: {
      value: (x: number, y: number) => y,
      default: () => 0,
    },
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
  };
