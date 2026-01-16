"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Cloud, ArrowRight, Check, X, AlertTriangle } from 'lucide-react'

interface LocalArticle {
  id: string
  title: string
  domain?: string
  url?: string
  content?: string
  progress: number
  lastRead: number
  type?: 'text' | 'markdown'
}

interface LocalConcept {
  term: string
  myDefinition: string
  myExample: string
  myConnection?: string
  confidence: number
  createdAt: number
  sourceArticleId?: string
  lastReviewedAt?: number
  reviewCount?: number
  nextReviewDate?: number
  easeFactor?: number
  interval?: number
}

export default function MigratePage() {
  const router = useRouter()
  const [migrating, setMigrating] = useState(false)
  const [result, setResult] = useState<{
    success: boolean
    articles: { total: number; synced: number; errors: number }
    concepts: { total: number; synced: number; errors: number }
  } | null>(null)
  const [localData, setLocalData] = useState<{
    articles: LocalArticle[]
    concepts: LocalConcept[]
  }>({ articles: [], concepts: [] })

  useEffect(() => {
    // Check for local data
    if (typeof window !== 'undefined') {
      const articlesRaw = window.localStorage.getItem('articles')
      const articles = articlesRaw ? JSON.parse(articlesRaw) : []

      const conceptsRaw = window.localStorage.getItem('concept-storage')
      const conceptsStored = conceptsRaw ? JSON.parse(conceptsRaw) : { state: { concepts: {} } }
      const concepts = Object.values(conceptsStored.state?.concepts || {}) as LocalConcept[]

      setLocalData({ articles, concepts })
    }
  }, [])

  const handleMigrate = async () => {
    setMigrating(true)

    try {
      let articlesSynced = 0
      let articlesErrors = 0
      let conceptsSynced = 0
      let conceptsErrors = 0

      // Migrate articles
      for (const article of localData.articles) {
        try {
          const res = await fetch('/api/articles', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: article.id,
              title: article.title,
              content: article.content,
              type: article.type || 'text',
              url: article.url || null,
              domain: article.domain || null,
              progress: article.progress || 0,
              totalBlocks: 0,
              completedBlocks: 0,
            }),
          })

          if (res.ok) {
            articlesSynced++
          } else {
            articlesErrors++
          }
        } catch (error) {
          console.error('Failed to migrate article:', error)
          articlesErrors++
        }
      }

      // Migrate concepts
      for (const concept of localData.concepts) {
        try {
          const res = await fetch('/api/concepts', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(concept),
          })

          if (res.ok) {
            conceptsSynced++
          } else {
            conceptsErrors++
          }
        } catch (error) {
          console.error('Failed to migrate concept:', error)
          conceptsErrors++
        }
      }

      setResult({
        success: true,
        articles: { total: localData.articles.length, synced: articlesSynced, errors: articlesErrors },
        concepts: { total: localData.concepts.length, synced: conceptsSynced, errors: conceptsErrors },
      })
    } catch (error) {
      console.error('Migration failed:', error)
      setResult({
        success: false,
        articles: { total: 0, synced: 0, errors: 0 },
        concepts: { total: 0, synced: 0, errors: 0 },
      })
    } finally {
      setMigrating(false)
    }
  }

  const handleClearLocal = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('articles')
      window.localStorage.removeItem('concept-storage')
      router.push('/')
    }
  }

  const handleSkip = () => {
    router.push('/')
  }

  const totalItems = localData.articles.length + localData.concepts.length

  if (totalItems === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-8 text-center"
        >
          <Check className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">
            No Local Data Found
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            You're all set! No migration needed.
          </p>
          <button
            onClick={() => router.push('/')}
            className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium"
          >
            Continue to App
          </button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-8"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Cloud className="w-8 h-8 text-purple-600 dark:text-purple-400" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">
            Welcome to Cloud Sync!
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            We found {totalItems} local {totalItems === 1 ? 'item' : 'items'} on your device.
          </p>
        </div>

        {/* Local Data Summary */}
        <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4 mb-6 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Articles</span>
            <span className="font-medium text-zinc-900 dark:text-white">{localData.articles.length}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Concepts</span>
            <span className="font-medium text-zinc-900 dark:text-white">{localData.concepts.length}</span>
          </div>
        </div>

        {result ? (
          result.success ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-green-50 dark:bg-green-900/20 rounded-lg p-6 mb-6"
            >
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-4">
                <Check className="w-5 h-5" />
                <span className="font-semibold">Migration Complete!</span>
              </div>

              <div className="space-y-3 mb-6">
                <div className="text-sm text-zinc-600 dark:text-zinc-400">
                  <div className="flex justify-between">
                    <span>Articles:</span>
                    <span className="text-green-600 dark:text-green-400">
                      {result.articles.synced}/{result.articles.total} synced
                    </span>
                  </div>
                  {result.articles.errors > 0 && (
                    <div className="text-red-500 text-xs mt-1">
                      {result.articles.errors} failed
                    </div>
                  )}
                </div>

                <div className="text-sm text-zinc-600 dark:text-zinc-400">
                  <div className="flex justify-between">
                    <span>Concepts:</span>
                    <span className="text-green-600 dark:text-green-400">
                      {result.concepts.synced}/{result.concepts.total} synced
                    </span>
                  </div>
                  {result.concepts.errors > 0 && (
                    <div className="text-red-500 text-xs mt-1">
                      {result.concepts.errors} failed
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <button
                  onClick={handleClearLocal}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
                >
                  Clear Local Data & Continue
                </button>
                <button
                  onClick={() => router.push('/')}
                  className="w-full py-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg font-medium transition-colors"
                >
                  Keep Local Data & Continue
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 dark:bg-red-900/20 rounded-lg p-6 mb-6"
            >
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-2">
                <X className="w-5 h-5" />
                <span className="font-semibold">Migration Failed</span>
              </div>
              <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-4">
                Something went wrong. Please try again or contact support.
              </p>
              <button
                onClick={() => router.push('/')}
                className="w-full py-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg font-medium transition-colors"
              >
                Continue Anyway
              </button>
            </motion.div>
          )
        ) : (
          <div className="space-y-4">
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800 dark:text-amber-200">
                <p className="font-medium mb-1">Recommendation</p>
                <p className="text-amber-700 dark:text-amber-300">
                  We recommend migrating your local data to the cloud for safekeeping and cross-device access.
                </p>
              </div>
            </div>

            <button
              onClick={handleMigrate}
              disabled={migrating}
              className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {migrating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Migrating...
                </>
              ) : (
                <>
                  Migrate to Cloud
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            <button
              onClick={handleSkip}
              disabled={migrating}
              className="w-full py-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Skip (Local Data Will Not Be Accessible)
            </button>
          </div>
        )}
      </motion.div>
    </div>
  )
}
