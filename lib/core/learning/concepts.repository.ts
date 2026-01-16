import { prisma } from '@/lib/infrastructure/database/prisma';
import { NotFoundError } from '@/lib/infrastructure/error';
import { z } from 'zod';
import { ConceptSchema, ConceptUpdateSchema } from '@/lib/shared/validation/schemas';
import { generateEmbedding } from '@/lib/infrastructure/ai/embedding';

type CreateConceptInput = z.infer<typeof ConceptSchema>;
type UpdateConceptInput = z.infer<typeof ConceptUpdateSchema>;

export class ConceptsRepository {
  static async findAll(userId: string, options?: { limit?: number; due?: boolean }) {
    const { limit = 50, due } = options || {};

    const where: any = {
      userId,
      deletedAt: null,
    };

    if (due) {
      where.OR = [
        { nextReviewDate: null },
        { nextReviewDate: { lte: new Date() } },
      ];
    }

    return prisma.concept.findMany({
      where,
      orderBy: due
        ? [{ nextReviewDate: 'asc' }]
        : [{ createdAt: 'desc' }],
      take: limit,
      select: {
        id: true,
        term: true,
        myDefinition: true,
        myExample: true,
        myConnection: true,
        confidence: true,
        aiDefinition: true,
        aiExample: true,
        aiRelatedConcepts: true,
        sourceArticleId: true,
        isAiCollected: true,
        createdAt: true,
        updatedAt: true,
        lastReviewedAt: true,
        reviewCount: true,
        nextReviewDate: true,
        easeFactor: true,
        interval: true,
        tags: true,
      },
    });
  }

  static async findById(id: string, userId: string) {
    const concept = await prisma.concept.findFirst({
      where: {
        id,
        userId,
        deletedAt: null,
      },
    });

    if (!concept) {
      throw new NotFoundError('Concept not found');
    }

    return concept;
  }

  static async create(userId: string, data: CreateConceptInput) {
    // Generate embedding for the concept (term + definition)
    let embedding: number[] | undefined;
    try {
      const textToEmbed = `${data.term}: ${data.myDefinition}`;
      embedding = await generateEmbedding(textToEmbed);
    } catch (error) {
      console.warn('Failed to generate embedding for new concept:', error);
      // Proceed without embedding, can be backfilled later
    }

    // Use queryRaw for insertion if we have embedding, or standard create if not
    // Note: Prisma supports creating unsupported types via standard create if mapped correctly,
    // but vector types often need specific handling. 
    // However, Prisma 5+ with postgresqlExtensions and typed sql is better.
    // For now, since 'embedding' is Unsupported("vector"), we might need raw SQL to insert it
    // OR ignore it in standard create and update it via raw SQL immediately after.
    
    // Standard create first (embedding will be null)
    const concept = await prisma.concept.create({
      data: {
        userId,
        term: data.term,
        myDefinition: data.myDefinition,
        myExample: data.myExample,
        myConnection: data.myConnection || null,
        confidence: data.confidence,
        aiDefinition: data.aiDefinition || null,
        aiExample: data.aiExample || null,
        aiRelatedConcepts: data.aiRelatedConcepts || [],
        sourceArticleId: data.sourceArticleId || null,
        isAiCollected: data.isAiCollected,
        tags: data.tags,
      },
    });

    // Update with embedding if available
    if (embedding) {
      await this.updateEmbedding(concept.id, embedding);
    }

    return concept;
  }

  static async update(userId: string, data: UpdateConceptInput) {
    const { id, ...updateData } = data;

    // Verify ownership
    const existing = await this.findById(id, userId);

    const updated = await prisma.concept.update({
      where: { id },
      data: {
        ...updateData,
        updatedAt: new Date(),
      },
    });

    // If term or definition changed, regenerate embedding
    if ((updateData.term && updateData.term !== existing.term) || 
        (updateData.myDefinition && updateData.myDefinition !== existing.myDefinition)) {
      try {
        const term = updateData.term || existing.term;
        const def = updateData.myDefinition || existing.myDefinition;
        const embedding = await generateEmbedding(`${term}: ${def}`);
        await this.updateEmbedding(id, embedding);
      } catch (error) {
        console.warn('Failed to update embedding for modified concept:', error);
      }
    }

    return updated;
  }

  static async softDelete(id: string, userId: string) {
    // Verify ownership
    await this.findById(id, userId);

    return prisma.concept.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Helper to update embedding using raw SQL
   */
  private static async updateEmbedding(id: string, embedding: number[]) {
    // Format vector as string: '[0.1, 0.2, ...]'
    const vectorStr = `[${embedding.join(',')}]`;
    
    // Explicitly cast to vector(1536) to match the new schema definition
    await prisma.$executeRaw`
      UPDATE concepts 
      SET embedding = ${vectorStr}::vector(1536)
      WHERE id = ${id}::uuid
    `;
  }

  /**
   * Find semantically similar concepts
   */
  static async findRelated(userId: string, text: string, limit = 5, threshold = 0.7) {
    const embedding = await generateEmbedding(text);
    const vectorStr = `[${embedding.join(',')}]`;

    // Perform similarity search using cosine distance (<=> operator is distance, 1 - distance = similarity)
    // We want 1 - (embedding <=> query) > threshold
    // <=> returns 0..2 (0 is identical) for normalized vectors? 
    // Actually cosine distance is 1 - cosine similarity. 
    // So order by embedding <=> vector ASC.
    
    const results = await prisma.$queryRaw`
      SELECT 
        id, 
        term, 
        my_definition as "myDefinition", 
        1 - (embedding <=> ${vectorStr}::vector(1536)) as similarity
      FROM concepts
      WHERE user_id = ${userId}::uuid
        AND deleted_at IS NULL
        AND embedding IS NOT NULL
        AND 1 - (embedding <=> ${vectorStr}::vector(1536)) > ${threshold}
      ORDER BY similarity DESC
      LIMIT ${limit};
    `;

    return results as Array<{
      id: string;
      term: string;
      myDefinition: string;
      similarity: number;
    }>;
  }
}
