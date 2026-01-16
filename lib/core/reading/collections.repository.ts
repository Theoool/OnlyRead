import { prisma } from '@/lib/infrastructure/database/prisma';
import { Prisma } from '@/lib/generated/prisma';

export type Collection = Prisma.CollectionGetPayload<{
  include: { _count: { select: { articles: true } } }
}>;

export class CollectionsRepository {
  /**
   * Find all collections for a user
   */
  static async findAll(userId: string): Promise<Collection[]> {
    return prisma.collection.findMany({
      where: { userId },
      include: {
        _count: {
          select: { articles: true }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });
  }

  /**
   * Find a collection by ID
   */
  static async findById(id: string, userId: string) {
    return prisma.collection.findUnique({
      where: { id, userId },
      include: {
        _count: {
          select: { articles: true }
        },
        articles: {
          where: { deletedAt: null },
          orderBy: { order: 'asc' },
          select: {
            id: true,
            title: true,
            progress: true,
            order: true,
            // Exclude content for performance
          }
        }
      }
    });
  }

  /**
   * Create a new collection
   */
  static async create(userId: string, data: Omit<Prisma.CollectionCreateInput, 'user'>) {
    return prisma.collection.create({
      data: {
        ...data,
        user: { connect: { id: userId } }
      }
    });
  }

  /**
   * Update a collection
   */
  static async update(id: string, userId: string, data: Prisma.CollectionUpdateInput) {
    return prisma.collection.update({
      where: { id, userId },
      data
    });
  }

  /**
   * Delete a collection
   */
  static async delete(id: string, userId: string) {
    return prisma.collection.delete({
      where: { id, userId }
    });
  }
}
