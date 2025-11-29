export const ARTICLES_KEY = "articles";

export interface Article {
  id: string;
  title: string;
  domain: string;
  url?: string;
  content?: string; // For manual text or Markdown
  html?: string;    // For fetched html
  progress: number;
  lastRead: number;
  lastReadSentence?: number; // Index of last read sentence
  type?: 'text' | 'markdown';
}

export function getArticles(): Article[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ARTICLES_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as Article[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function getArticle(id: string): Article | undefined {
  const list = getArticles();
  return list.find((a) => a.id === id);
}

export function saveArticles(list: Article[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ARTICLES_KEY, JSON.stringify(list));
  } catch {}
}

export function insertArticle(article: Article) {
  const list = getArticles();
  // Remove existing if any
  const filtered = list.filter((a) => a.id !== article.id);
  const next = [article, ...filtered].slice(0, 20);
  saveArticles(next);
  return next;
}

export function updateArticle(id: string, patch: Partial<Article>) {
  const list = getArticles();
  const next = list.map((a) => (a.id === id ? { ...a, ...patch } : a));
  saveArticles(next);
  return next.find((a) => a.id === id);
}

