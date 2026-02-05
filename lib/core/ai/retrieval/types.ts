export interface RetrievalFilter {
  articleIds?: string[];
  collectionId?: string;
  domain?: string;
}

export interface RetrievalOptions {
  query: string;
  userId: string;
  filter?: RetrievalFilter;
  /**
   * - comprehensive: Fetches article summaries if needed (e.g., for planning)
   * - fast: Fetches chunks only (default)
   */
  mode?: 'comprehensive' | 'fast';
  topK?: number;
}

export interface SearchResult {
  articleId: string;
  title: string;
  excerpt: string; // The chunk content or summary
  content: string; // Full content available
  similarity: number;
  domain: string | null;
}

export interface RetrievalResult {
  documents: string; // Formatted text for LLM context
  sources: SearchResult[];
}
