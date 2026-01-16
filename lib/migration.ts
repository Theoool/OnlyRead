'use client'

import { createClient } from '@/lib/supabase/client'

interface LocalConcept {
  term: string
  myDefinition: string
  myExample: string
  myConnection?: string
  confidence: number
  aiDefinition?: string
  aiExample?: string
  aiRelatedConcepts?: any[]
  sourceArticleId?: string
  isAiCollected?: boolean
  tags?: string[]
  createdAt?: number
  lastReviewedAt?: number
  reviewCount?: number
  nextReviewDate?: number
  easeFactor?: number
  interval?: number
}

interface LocalArticle {
  id: string
  title?: string
  content: string
  type?: 'markdown' | 'text'
  url?: string
  domain?: string
  progress?: number
  currentPosition?: number
  totalBlocks?: number
  completedBlocks?: number
  totalReadingTime?: number
  createdAt?: number
}

interface MigrationResult {
  success: boolean
  conceptsMigrated: number
  articlesMigrated: number
  errors: string[]
}

/**
 * Migrate data from localStorage to Supabase
 */
export async function migrateToSupabase(): Promise<MigrationResult> {
  const supabase = createClient()
  const errors: string[] = []
  let conceptsMigrated = 0
  let articlesMigrated = 0

  try {
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      throw new Error('User not authenticated. Please sign in first.')
    }

    // Migrate concepts
    const conceptsData = localStorage.getItem('concept-storage')
    if (conceptsData) {
      try {
        const concepts: Record<string, LocalConcept> = JSON.parse(conceptsData)
        const conceptsArray = Object.values(concepts)

        if (conceptsArray.length > 0) {
          const response = await fetch('/api/concepts/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ concepts: conceptsArray }),
          })

          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Failed to migrate concepts')
          }

          const result = await response.json()
          conceptsMigrated = result.count
        }
      } catch (error: any) {
        errors.push(`Concepts migration failed: ${error.message}`)
      }
    }

    // Migrate articles
    const articlesData = localStorage.getItem('articles')
    if (articlesData) {
      try {
        const articles: LocalArticle[] = JSON.parse(articlesData)

        if (articles.length > 0) {
          const response = await fetch('/api/articles/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ articles }),
          })

          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Failed to migrate articles')
          }

          const result = await response.json()
          articlesMigrated = result.count
        }
      } catch (error: any) {
        errors.push(`Articles migration failed: ${error.message}`)
      }
    }

    // Create backup
    const backup = {
      concepts: conceptsData,
      articles: articlesData,
      migratedAt: new Date().toISOString(),
    }
    localStorage.setItem('migration-backup', JSON.stringify(backup))

    return {
      success: errors.length === 0,
      conceptsMigrated,
      articlesMigrated,
      errors,
    }
  } catch (error: any) {
    return {
      success: false,
      conceptsMigrated,
      articlesMigrated,
      errors: [error.message],
    }
  }
}

/**
 * Check if migration has been done before
 */
export function hasMigrationBackup(): boolean {
  return !!localStorage.getItem('migration-backup')
}

/**
 * Restore data from backup
 */
export function restoreFromBackup(): boolean {
  const backup = localStorage.getItem('migration-backup')
  if (!backup) return false

  try {
    const data = JSON.parse(backup)
    if (data.concepts) {
      localStorage.setItem('concept-storage', data.concepts)
    }
    if (data.articles) {
      localStorage.setItem('articles', data.articles)
    }
    return true
  } catch {
    return false
  }
}

/**
 * Get migration statistics
 */
export function getMigrationStats() {
  const conceptsData = localStorage.getItem('concept-storage')
  const articlesData = localStorage.getItem('articles')
  const backup = localStorage.getItem('migration-backup')

  let conceptsCount = 0
  let articlesCount = 0

  if (conceptsData) {
    try {
      const concepts: Record<string, any> = JSON.parse(conceptsData)
      conceptsCount = Object.keys(concepts).length
    } catch {}
  }

  if (articlesData) {
    try {
      const articles: any[] = JSON.parse(articlesData)
      articlesCount = articles.length
    } catch {}
  }

  return {
    conceptsCount,
    articlesCount,
    hasBackup: !!backup,
    backupDate: backup ? JSON.parse(backup).migratedAt : null,
  }
}
