import { z } from 'zod';
import { BaseMessage } from '@langchain/core/messages';
import { LearningResponse } from '../schemas';

/**
 * State Definition for the Learning Graph
 */
  export const LearningGraphState= {
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
      value: (x: string, y: string) => y,
      default: () => undefined,
    },
    
    // Context
    currentTopic: {
      value: (x: string, y: string) => y,
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
    
    // Decision Output
    nextStep: {
      value: (x: string, y: string) => y,
      default: () => undefined,
    },
    reasoning: {
      value: (x: string, y: string) => y,
      default: () => undefined,
    },
    
    // Final Output Payload
    finalResponse: {
      value: (x: any, y: any) => y,
      default: () => undefined,
    },
  };
