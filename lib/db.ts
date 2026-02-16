import Dexie, { type EntityTable } from 'dexie';

export type SyncStatus = 'local' | 'uploading' | 'processing' | 'synced' | 'error';

export interface LocalBook {
  id: string; // uuid
  title: string;
  author?: string;
  cover?: Blob | string; // Base64 or Blob
  fileData: ArrayBuffer;
  format: 'epub' | 'pdf' | 'md' | 'txt';
  addedAt: number;
  progress?: number;
  lastRead?: number;
  
  // 同步状态追踪
  syncStatus: SyncStatus;
  cloudArticleId?: string;  // 同步后的云端文章 ID
  cloudCollectionId?: string; // 同步后的云端收藏集 ID
  syncError?: string;
  syncProgress?: number; // 0-100
  jobId?: string; // 用于追踪导入进度
}

const db = new Dexie('AntiAiReaderDB') as Dexie & {
  books: EntityTable<LocalBook, 'id'>;
};

// Schema declaration:
db.version(2).stores({
  books: 'id, title, addedAt, lastRead, syncStatus' // Primary key and indexed props
});

export async function swapBookId(oldId: string, newId: string) {
  await db.transaction('rw', db.books, async () => {
    const oldBook = await db.books.get(oldId);
    if (oldBook) {
      await db.books.add({ ...oldBook, id: newId });
      await db.books.delete(oldId);
    }
  });
}

export { db };
