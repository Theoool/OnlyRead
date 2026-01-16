import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CollectionsRepository } from '@/lib/core/reading/collections.repository';
import { prisma } from '@/lib/infrastructure/database/prisma';

// Mock prisma
vi.mock('@/lib/infrastructure/database/prisma', () => ({
  prisma: {
    collection: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

describe('CollectionsRepository', () => {
  const userId = 'user-123';
  const collectionId = 'col-123';
  const mockDate = new Date();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return collections for a user', async () => {
      const mockCollections = [
        { id: '1', title: 'Book 1', userId, updatedAt: mockDate },
        { id: '2', title: 'Book 2', userId, updatedAt: mockDate },
      ];

      (prisma.collection.findMany as any).mockResolvedValue(mockCollections);

      const result = await CollectionsRepository.findAll(userId);

      expect(prisma.collection.findMany).toHaveBeenCalledWith({
        where: { userId },
        include: {
          _count: {
            select: { articles: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
      });
      expect(result).toEqual(mockCollections);
    });
  });

  describe('create', () => {
    it('should create a collection and connect user', async () => {
      const input = {
        title: 'New Book',
        description: 'Desc',
        type: 'BOOK',
      };

      const created = { ...input, id: collectionId, userId, updatedAt: mockDate, createdAt: mockDate };

      (prisma.collection.create as any).mockResolvedValue(created);

      const result = await CollectionsRepository.create(userId, input);

      expect(prisma.collection.create).toHaveBeenCalledWith({
        data: {
          ...input,
          user: { connect: { id: userId } },
        },
      });
      expect(result).toEqual(created);
    });
  });
});
