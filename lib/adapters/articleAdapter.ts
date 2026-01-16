import { Article } from '@/lib/articles';
import { useAuthStore } from '@/lib/store/useAuthStore';

/**
 * Article Data Adapter
 * Automatically switches between localStorage and API based on auth mode
 */

export class ArticleAdapter {
  /**
   * Get all articles
   */
  static async getArticles(): Promise<Article[]> {
    const { canUseCloudFeatures } = useAuthStore.getState();

    if (canUseCloudFeatures()) {
      return this.getArticlesFromAPI();
    }

    return this.getArticlesFromLocal();
  }

  /**
   * Get articles from localStorage
   */
  private static getArticlesFromLocal(): Article[] {
    if (typeof window === 'undefined') return [];

    const stored = localStorage.getItem('articles');
    return stored ? JSON.parse(stored) : [];
  }

  /**
   * Get articles from API
   */
  private static async getArticlesFromAPI(): Promise<Article[]> {
    try {
      const res = await fetch('/api/articles');
      if (!res.ok) throw new Error('Failed to fetch articles');

      const data = await res.json();
      const articles: Article[] = data.articles.map((article: any) => ({
        id: article.id,
        title: article.title,
        content: article.content,
        type: article.type,
        url: article.url,
        domain: article.domain,
        progress: article.progress,
        currentPosition: article.currentPosition,
        totalBlocks: article.totalBlocks,
        completedBlocks: article.completedBlocks,
        readingStartTime: article.readingStartTime ? new Date(article.readingStartTime).getTime() : null,
        readingEndTime: article.readingEndTime ? new Date(article.readingEndTime).getTime() : null,
        totalReadingTime: article.totalReadingTime,
        lastRead: new Date(article.createdAt).getTime(),
      }));

      // Update localStorage as cache
      localStorage.setItem('articles', JSON.stringify(articles));

      return articles;
    } catch (error) {
      console.error('Error fetching articles from API:', error);
      // Fallback to localStorage
      return this.getArticlesFromLocal();
    }
  }

  /**
   * Get a single article
   */
  static async getArticle(id: string): Promise<Article | null> {
    const articles = await this.getArticles();
    return articles.find((a) => a.id === id) || null;
  }

  /**
   * Save an article
   */
  static async saveArticle(article: Article): Promise<Article> {
    const { canUseCloudFeatures } = useAuthStore.getState();

    if (canUseCloudFeatures()) {
      return this.saveArticleToAPI(article);
    }

    return this.saveArticleToLocal(article);
  }

  /**
   * Save article to localStorage
   */
  private static saveArticleToLocal(article: Article): Article {
    if (typeof window === 'undefined') return article;

    const articles = this.getArticlesFromLocal();
    const existingIndex = articles.findIndex((a) => a.id === article.id);

    if (existingIndex >= 0) {
      articles[existingIndex] = article;
    } else {
      articles.push(article);
    }

    localStorage.setItem('articles', JSON.stringify(articles));
    return article;
  }

  /**
   * Save article to API
   */
  private static async saveArticleToAPI(article: Article): Promise<Article> {
    try {
      const payload = {
        id: article.id,
        title: article.title,
        content: article.content,
        type: article.type,
        url: article.url,
        domain: article.domain,
        progress: article.progress,
        currentPosition: (article as any).currentPosition,
        totalBlocks: (article as any).totalBlocks,
        completedBlocks: (article as any).completedBlocks,
        readingStartTime: (article as any).readingStartTime ? new Date((article as any).readingStartTime).toISOString() : null,
        readingEndTime: (article as any).readingEndTime ? new Date((article as any).readingEndTime).toISOString() : null,
        totalReadingTime: (article as any).totalReadingTime,
      };

      const res = await fetch('/api/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to save article');

      // Update localStorage cache
      const articles = this.getArticlesFromLocal();
      const existingIndex = articles.findIndex((a) => a.id === article.id);

      if (existingIndex >= 0) {
        articles[existingIndex] = article;
      } else {
        articles.push(article);
      }

      localStorage.setItem('articles', JSON.stringify(articles));

      return article;
    } catch (error) {
      console.error('Error saving article to API:', error);
      // Fallback to localStorage
      return this.saveArticleToLocal(article);
    }
  }

  /**
   * Update article progress
   */
  static async updateArticleProgress(
    id: string,
    progress: number,
    currentPosition: number,
    completedBlocks: number
  ): Promise<void> {
    const { canUseCloudFeatures } = useAuthStore.getState();

    if (canUseCloudFeatures()) {
      try {
        await fetch(`/api/articles/${id}/progress`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ progress, currentPosition, completedBlocks }),
        });
      } catch (error) {
        console.error('Error updating progress in API:', error);
      }
    }

    // Always update localStorage
    const articles = this.getArticlesFromLocal();
    const article = articles.find((a) => a.id === id);

    if (article) {
      article.progress = progress;
      (article as any).currentPosition = currentPosition;
      (article as any).completedBlocks = completedBlocks;
      article.lastRead = Date.now();
      localStorage.setItem('articles', JSON.stringify(articles));
    }
  }

  /**
   * Delete an article
   */
  static async deleteArticle(id: string): Promise<void> {
    const { canUseCloudFeatures } = useAuthStore.getState();

    if (canUseCloudFeatures()) {
      try {
        await fetch(`/api/articles/${id}`, {
          method: 'DELETE',
        });
      } catch (error) {
        console.error('Error deleting article from API:', error);
      }
    }

    // Always delete from localStorage
    const articles = this.getArticlesFromLocal();
    const filtered = articles.filter((a) => a.id !== id);
    localStorage.setItem('articles', JSON.stringify(filtered));
  }
}
