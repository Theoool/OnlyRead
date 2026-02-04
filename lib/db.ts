import Dexie, { type EntityTable } from 'dexie';

export interface LocalBook {
  id: string; // uuid
  title: string;
  author?: string;
  cover?: Blob | string; // Base64 or Blob
  fileData: ArrayBuffer;
  format: 'epub' | 'pdf';
  addedAt: number;
  progress?: number;
  lastRead?: number;
}

const db = new Dexie('AntiAiReaderDB') as Dexie & {
  books: EntityTable<LocalBook, 'id'>;
};

// Schema declaration:
db.version(1).stores({
  books: 'id, title, addedAt, lastRead' // Primary key and indexed props
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
