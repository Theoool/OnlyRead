import { z } from 'zod';

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
