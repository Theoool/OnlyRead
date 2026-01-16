/**
 * Legacy articles types and constants
 * Kept for backward compatibility
 */

export const ARTICLES_KEY = "articles";

export interface ConceptCardData {
  term: string;
  myDefinition: string;
  myExample: string;
  myConnection: string;
  confidence: number;
  createdAt: number;
}

export interface Article {
  id: string;
  title: string;
  domain: string;
  url?: string;
  content?: string; // For manual text or Markdown
  html?: string;    // For fetched html
  progress: number;
  lastRead: number;
  lastReadSentence?: number; // Index of last read sentence
  type?: 'text' | 'markdown';
  conceptCards?: ConceptCardData[];
  totalBlocks?: number;
  completedBlocks?: number;
  totalReadingTime?: number;
  createdAt?: string;
  updatedAt?: string;
}
