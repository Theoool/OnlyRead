'use client'

import React from 'react'
import { CopilotDebugState } from './useCopilot'

function formatMs(ms: number) {
  return `${Math.max(0, Math.round(ms))}ms`
}

export function CopilotDebugBar({
  enabled,
  debug,
  onToggle,
}: {
  enabled: boolean
  debug: CopilotDebugState
  onToggle: () => void
}) {
  const lastStep = debug.steps[debug.steps.length - 1]
  const firstStep = debug.steps[0]
  const elapsed = firstStep ? Date.now() - firstStep.at : 0

  return (
    <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/40 backdrop-blur">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] text-zinc-600 dark:text-zinc-300 min-w-0">
          <span className="font-mono text-zinc-500 dark:text-zinc-400">调试</span>
          {debug.traceId ? (
            <span className="font-mono truncate">追踪 {debug.traceId.slice(0, 8)}</span>
          ) : (
            <span className="text-zinc-400">追踪 -</span>
          )}
          {debug.mode ? <span className="text-zinc-500">模式 {debug.mode}</span> : null}
          {lastStep ? <span className="text-zinc-500">步骤 {lastStep.name}</span> : null}
          {firstStep ? <span className="text-zinc-400">耗时 {formatMs(elapsed)}</span> : null}
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="text-[11px] px-2 py-1 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-200"
        >
          {enabled ? '收起' : '展开'}
        </button>
      </div>

      {enabled && (
        <div className="mt-2 grid grid-cols-1 gap-2 text-[11px]">
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-zinc-600 dark:text-zinc-300">
            <span>事件: {debug.lastEvent || '-'}</span>
            <span>步骤数: {debug.steps.length}</span>
            {debug.lastSources ? (
              <span>
                来源: {debug.lastSources.count ?? '-'}
                {typeof debug.lastSources.minSimilarity === 'number'
                  ? `（最小相似度 ${debug.lastSources.minSimilarity}）`
                  : ''}
                {typeof debug.lastSources.minSources === 'number'
                  ? `（最少来源数 ${debug.lastSources.minSources}）`
                  : ''}
              </span>
            ) : (
              <span>来源: -</span>
            )}
            <span>错误: {debug.errors.length}</span>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-2 overflow-auto max-h-32">
            <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mb-1">检索策略（retrievalPolicy）</div>
            <pre className="text-[10px] leading-snug text-zinc-800 dark:text-zinc-100 whitespace-pre-wrap break-words">
              {debug.retrievalPolicy ? JSON.stringify(debug.retrievalPolicy, null, 2) : 'null'}
            </pre>
          </div>

          {debug.errors.length > 0 && (
            <div className="bg-red-50/70 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-lg p-2 overflow-auto max-h-28">
              <div className="text-[10px] text-red-700 dark:text-red-300 mb-1">错误详情</div>
              <pre className="text-[10px] leading-snug text-red-800 dark:text-red-200 whitespace-pre-wrap break-words">
                {JSON.stringify(debug.errors.slice(-3), null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
