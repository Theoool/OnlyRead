"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store/useAuthStore'

export function MigrationCheck({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) {
      setChecked(true)
      return
    }

    // Check if migration is needed
    const articlesRaw = window.localStorage.getItem('articles')
    const conceptsRaw = window.localStorage.getItem('concept-storage')

    const hasLocalData = articlesRaw || conceptsRaw

    // Check if we already prompted for migration
    const migrationPrompted = window.sessionStorage.getItem('migration-prompted')

    if (hasLocalData && !migrationPrompted) {
      // Mark that we prompted
      window.sessionStorage.setItem('migration-prompted', 'true')
      // Redirect to migration page
      router.push('/migrate')
    } else {
      setChecked(true)
    }
  }, [isAuthenticated, router])

  if (!checked) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-black dark:border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-500 dark:text-zinc-400">正在检查数据...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
