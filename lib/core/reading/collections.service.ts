import { get, post, del } from '@/lib/infrastructure/api/client';
import { Article } from './articles.service';

export interface Collection {
  id: string;
  title: string;
  description?: string;
  cover?: string;
  type: 'SERIES' | 'BOOK' | 'COURSE';
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
