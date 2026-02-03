import { z } from 'zod';
import { API_CONFIG } from '@/lib/config/constants';

// Re-export for consistency
export { z };

/**
 * Article Validation Schemas
 */
export const ArticleSchema = z.object({
  id: z.string().optional(),
  title: z.string().nullable().optional(),
  content: z.string().min(1, "Content is required"),
  type: z.enum(['text', 'markdown']).default('markdown'),
  url: z.string().url().nullable().optional(),
  domain: z.string().nullable().optional(),
  progress: z.number().min(0).max(100).default(0),
  totalBlocks: z.number().int().min(0).default(0),
  completedBlocks: z.number().int().min(0).default(0),
});

export const ArticleUpdateSchema = ArticleSchema.partial().extend({
  id: z.string(), // ID is required for updates
});

/**
 * Concept Validation Schemas
 */
export const ConceptSchema = z.object({
  term: z.string().min(1, "Term is required"),
  myDefinition: z.string().min(1, "Definition is required"),
  myExample: z.string().min(1, "Example is required"),
  myConnection: z.string().nullable().optional(),
  confidence: z.number().int().min(1).max(5).default(3),
  aiDefinition: z.string().nullable().optional(),
  aiExample: z.string().nullable().optional(),
  aiRelatedConcepts: z.any().optional(), // JSON
  sourceArticleId: z.string().nullable().optional(),
  isAiCollected: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
});

export const ConceptUpdateSchema = ConceptSchema.partial().extend({
  id: z.string(), // ID is required for updates
});

export const ReviewSchema = z.object({
  conceptId: z.string().uuid(),
  quality: z.number().int().min(0).max(5),
});

/**
 * Collection Validation Schemas
 */
export const CollectionCreateSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  description: z.string().max(2000).optional(),
  type: z.enum(['SERIES', 'BOOK', 'COURSE']).default('SERIES'),
  author: z.string().max(255).optional(),
  isbn: z.string().max(50).regex(/^[\d-X]+$/, 'Invalid ISBN format').optional(),
  language: z.string().max(10).default('zh-CN'),
  cover: z.string().url('Invalid cover URL').optional(),
});

export const CollectionUpdateSchema = CollectionCreateSchema.partial().extend({
  id: z.string().uuid(),
});

/**
 * QA Request Validation Schema
 */
export const QaRequestSchema = z.object({
  question: z.string()
    .min(1, 'Question is required')
    .max(2000, 'Question too long'),
  topK: z.number()
    .int()
    .min(1)
    .max(12)
    .default(API_CONFIG.DEFAULT_TOP_K),
  collectionId: z.string().uuid().optional(),
  articleIds: z.array(z.string().uuid()).max(10).optional(),
});

/**
 * Search Query Validation Schema
 */
export const SearchQuerySchema = z.object({
  q: z.string().min(1, 'Query is required').max(200),
  type: z.enum(['all', 'concepts', 'articles']).default('all'),
  limit: z.number().int().min(1).max(50).default(20),
  vector: z.boolean().default(true),
});
