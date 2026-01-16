import { get, post, del } from '@/lib/infrastructure/api/client';
import { Article } from './articles.service';

export interface Collection {
  id: string;
  title: string;
  description?: string;
  cover?: string;
  type: 'SERIES' | 'BOOK' | 'COURSE';

  // ✅ 新增: Book元数据
  author?: string | null;
  language?: string | null;
  isbn?: string | null;

  // ✅ 新增: 进度聚合
  totalChapters?: number;
  completedChapters?: number;
  readingProgress?: number;

  // ✅ 新增: 统计
  totalWords?: number | null;
  estimatedReadTime?: number | null;

  // ✅ 新增: 用户偏好
  userPreferences?: any;

  createdAt: string;
  updatedAt: string;
  articles?: Article[];
  _count?: {
    articles: number;
  };
}

interface CollectionsResponse {
  collections: Collection[];
}

interface CollectionResponse {
  collection: Collection;
}

/**
 * Fetch all collections
 */
export async function getCollections(): Promise<Collection[]> {
  const response = await get<CollectionsResponse>('/api/collections');
  return response.collections || [];
}

/**
 * Fetch a single collection with its articles
 */
export async function getCollection(id: string): Promise<Collection | undefined> {
  try {
    const response = await get<CollectionResponse>(`/api/collections/${id}`);
    return response.collection;
  } catch (error) {
    console.error('Failed to get collection:', error);
    return undefined;
  }
}

/**
 * Delete a collection
 */
export async function deleteCollection(id: string): Promise<void> {
  await del<void>(`/api/collections/${id}`);
}
