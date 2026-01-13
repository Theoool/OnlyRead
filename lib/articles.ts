/**
 * Articles Module - Cloud-first architecture
 * All operations now go through the API
 *
 * @deprecated Use lib/api/articles.ts for new code
 * This file is kept for backward compatibility
 */

export { ARTICLES_KEY } from './articles-legacy'
export type { Article, ConceptCardData } from './articles-legacy'

export {
  getArticles,
  getArticle,
  createArticle,
  updateArticle,
  deleteArticle,
  saveArticle,
} from './api/articles'
