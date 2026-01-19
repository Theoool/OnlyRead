"use client"

import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import {
  ArrowLeft,
  BookOpen,
  Brain,
  Clock,
  TrendingUp,
  Flame,
  Target,
  BarChart3,
  Calendar,
} from "lucide-react"
import { useAllStats } from "@/lib/hooks"

export default function StatsPage() {
  const router = useRouter()
  const { learning, mastery, heatmap, isLoading, error } = useAllStats(90)

  const formatTime = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60))
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  const getHeatmapColor = (count: number, max: number) => {
    if (count === 0) return 'bg-zinc-100 dark:bg-zinc-800'
    const ratio = count / max
    if (ratio < 0.25) return 'bg-green-200 dark:bg-green-900'
    if (ratio < 0.5) return 'bg-green-300 dark:bg-green-800'
    if (ratio < 0.75) return 'bg-green-400 dark:bg-green-700'
    return 'bg-green-500 dark:bg-green-600'
  }

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-black dark:border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-500 dark:text-zinc-400">Loading stats...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black p-6">
      {/* Header */}
      <header className="max-w-7xl mx-auto mb-8">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </button>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Learning Statistics</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-2">Track your learning journey</p>
      </header>

      <main className="max-w-7xl mx-auto space-y-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Concepts */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-zinc-900 rounded-xl p-6 border border-zinc-200 dark:border-zinc-800"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
                <Brain className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            <div className="text-3xl font-bold text-zinc-900 dark:text-white">
              {learning?.totalConcepts || 0}
            </div>
            <div className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Total Concepts</div>
          </motion.div>

          {/* Total Reviews */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-zinc-900 rounded-xl p-6 border border-zinc-200 dark:border-zinc-800"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <div className="text-3xl font-bold text-zinc-900 dark:text-white">
              {learning?.totalReviews || 0}
            </div>
            <div className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Total Reviews</div>
          </motion.div>

          {/* Reading Time */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-zinc-900 rounded-xl p-6 border border-zinc-200 dark:border-zinc-800"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <div className="text-3xl font-bold text-zinc-900 dark:text-white">
              {learning ? formatTime(learning.totalReadingTime) : '0m'}
            </div>
            <div className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Total Reading Time</div>
          </motion.div>

          {/* Current Streak */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-zinc-900 rounded-xl p-6 border border-zinc-200 dark:border-zinc-800"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-lg flex items-center justify-center">
                <Flame className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
            <div className="text-3xl font-bold text-zinc-900 dark:text-white">
              {learning?.currentStreak || 0}
            </div>
            <div className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Day Streak 🔥</div>
          </motion.div>
        </div>

        {/* Mastery Distribution */}
        {mastery && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white dark:bg-zinc-900 rounded-xl p-6 border border-zinc-200 dark:border-zinc-800"
          >
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-6 flex items-center gap-2">
              <Target className="w-5 h-5" />
              Concept Mastery
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* New */}
              <div className="text-center">
                <div className="text-3xl font-bold text-zinc-400">
                  {mastery.breakdown.new.count}
                </div>
                <div className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">New</div>
                <div className="text-xs text-zinc-400 mt-1">
                  {mastery.breakdown.new.percentage}%
                </div>
              </div>
              {/* Learning */}
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                  {mastery.breakdown.learning.count}
                </div>
                <div className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Learning</div>
                <div className="text-xs text-zinc-400 mt-1">
                  {mastery.breakdown.learning.percentage}%
                </div>
              </div>
              {/* Mature */}
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {mastery.breakdown.mature.count}
                </div>
                <div className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Mature</div>
                <div className="text-xs text-zinc-400 mt-1">
                  {mastery.breakdown.mature.percentage}%
                </div>
              </div>
              {/* Lapsed */}
              <div className="text-center">
                <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                  {mastery.breakdown.lapsed.count}
                </div>
                <div className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Lapsed</div>
                <div className="text-xs text-zinc-400 mt-1">
                  {mastery.breakdown.lapsed.percentage}%
                </div>
              </div>
            </div>
            <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-800">
              <div className="flex justify-between items-center">
                <span className="text-sm text-zinc-500 dark:text-zinc-400">Mastery Rate</span>
                <span className="text-lg font-bold text-zinc-900 dark:text-white">
                  {mastery.masteryRate}%
                </span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Review Heatmap */}
        {heatmap && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white dark:bg-zinc-900 rounded-xl p-6 border border-zinc-200 dark:border-zinc-800"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Review Activity
              </h2>
              <div className="text-sm text-zinc-500 dark:text-zinc-400">
                {heatmap.activeDays} active days
              </div>
            </div>

            {/* Heatmap Grid - Simplified for MVP */}
            <div className="flex gap-1 overflow-x-auto pb-2">
              {heatmap.heatmap.slice(-90).reverse().map((day, index) => (
                <div
                  key={`${day.date}-${index}`}
                  className={`flex-shrink-0 w-3 h-3 rounded-sm ${getHeatmapColor(day.count, heatmap.maxReviews)}`}
                  title={`${day.date}: ${day.count} reviews`}
                />
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 mt-4 text-xs text-zinc-400">
              <span>Less</span>
              <div className="w-3 h-3 bg-zinc-100 dark:bg-zinc-800 rounded-sm" />
              <div className="w-3 h-3 bg-green-200 dark:bg-green-900 rounded-sm" />
              <div className="w-3 h-3 bg-green-400 dark:bg-green-700 rounded-sm" />
              <div className="w-3 h-3 bg-green-500 dark:bg-green-600 rounded-sm" />
              <span>More</span>
            </div>
          </motion.div>
        )}

        {/* Quick Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          {/* Articles Read */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <BookOpen className="w-5 h-5 text-zinc-400" />
              <div>
                <div className="text-2xl font-bold text-zinc-900 dark:text-white">
                  {learning?.totalArticles || 0}
                </div>
                <div className="text-sm text-zinc-500 dark:text-zinc-400">Articles Read</div>
              </div>
            </div>
          </div>

          {/* Completed */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <Target className="w-5 h-5 text-zinc-400" />
              <div>
                <div className="text-2xl font-bold text-zinc-900 dark:text-white">
                  {learning?.completedArticles || 0}
                </div>
                <div className="text-sm text-zinc-500 dark:text-zinc-400">Completed</div>
              </div>
            </div>
          </div>

          {/* Due for Review */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-5 h-5 text-zinc-400" />
              <div>
                <div className="text-2xl font-bold text-zinc-900 dark:text-white">
                  {mastery?.dueCount || 0}
                </div>
                <div className="text-sm text-zinc-500 dark:text-zinc-400">Due for Review</div>
              </div>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  )
}
