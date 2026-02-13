/**
 * 统一 ID 管理服务
 * 
 * 解决本地 ID 和云端 ID 的映射和查找问题
 */

import { db } from '@/lib/db';

export type ContentType = 'article' | 'collection';

export interface IdMapping {
  localId: string;
  cloudId?: string;
  type: ContentType;
  syncStatus: 'local' | 'uploading' | 'processing' | 'synced' | 'error';
}

/**
 * ID 管理器
 */
export class IdManager {
  /**
   * 生成新的本地 ID
   */
  static generateLocalId(): string {
    return crypto.randomUUID();
  }

  /**
   * 根据本地 ID 获取云端 ID
   */
  static async getCloudId(localId: string): Promise<{
    articleId?: string;
    collectionId?: string;
  } | null> {
    const book = await db.books.get(localId);
    if (!book) return null;

    return {
      articleId: book.cloudArticleId,
      collectionId: book.cloudCollectionId,
    };
  }

  /**
   * 根据云端 ID 查找本地 ID
   */
  static async getLocalIdByCloudId(cloudId: string, type: ContentType): Promise<string | null> {
    const books = await db.books.toArray();
    
    const book = books.find(b => {
      if (type === 'article') {
        return b.cloudArticleId === cloudId;
      } else {
        return b.cloudCollectionId === cloudId;
      }
    });

    return book?.id || null;
  }

  /**
   * 关联本地 ID 和云端 ID
   */
  static async linkIds(
    localId: string,
    cloudIds: {
      articleId?: string;
      collectionId?: string;
    }
  ): Promise<void> {
    await db.books.update(localId, {
      cloudArticleId: cloudIds.articleId,
      cloudCollectionId: cloudIds.collectionId,
      syncStatus: 'synced',
    });
  }

  /**
   * 检查内容是否已同步
   */
  static async isSynced(localId: string): Promise<boolean> {
    const book = await db.books.get(localId);
    return book?.syncStatus === 'synced';
  }

  /**
   * 获取完整的 ID 映射信息
   */
  static async getMapping(localId: string): Promise<IdMapping | null> {
    const book = await db.books.get(localId);
    if (!book) return null;

    return {
      localId: book.id,
      cloudId: book.cloudCollectionId || book.cloudArticleId,
      type: book.cloudCollectionId ? 'collection' : 'article',
      syncStatus: book.syncStatus,
    };
  }

  /**
   * 获取所有待同步的内容
   */
  static async getPendingSync(): Promise<IdMapping[]> {
    const books = await db.books
      .where('syncStatus')
      .anyOf(['local', 'error'])
      .toArray();

    return books.map(book => ({
      localId: book.id,
      cloudId: book.cloudCollectionId || book.cloudArticleId,
      type: book.cloudCollectionId ? 'collection' : 'article',
      syncStatus: book.syncStatus,
    }));
  }

  /**
   * 清理已同步的本地数据（可选）
   */
  static async cleanupSynced(localId: string, keepLocal: boolean = true): Promise<void> {
    if (!keepLocal) {
      const book = await db.books.get(localId);
      if (book?.syncStatus === 'synced') {
        await db.books.delete(localId);
      }
    }
  }
}

