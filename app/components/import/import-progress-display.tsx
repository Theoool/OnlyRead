/**
 * 导入进度显示组件
 * 
 * 显示文件上传和 AI 处理的进度
 */

import { motion } from "framer-motion";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { useJobProgress } from "@/lib/hooks/home/useJobProgress";

interface ImportProgressDisplayProps {
  jobId: string;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

export function ImportProgressDisplay({ 
  jobId, 
  onComplete, 
  onError 
}: ImportProgressDisplayProps) {
  const { jobStatus, isProcessing, isCompleted, isFailed, progress } = useJobProgress(jobId);

  // 触发回调
  if (isCompleted && onComplete) {
    setTimeout(onComplete, 500);
  }
  
  if (isFailed && onError && jobStatus?.error) {
    setTimeout(() => onError(jobStatus.error!), 500);
  }

  if (!jobStatus) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4"
    >
      <div className="flex items-center gap-3">
        {/* 状态图标 */}
        <div className="flex-shrink-0">
          {isProcessing && (
            <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
          )}
          {isCompleted && (
            <CheckCircle className="w-5 h-5 text-green-500" />
          )}
          {isFailed && (
            <AlertCircle className="w-5 h-5 text-red-500" />
          )}
        </div>

        {/* 进度信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {isProcessing && 'AI 处理中...'}
              {isCompleted && 'AI 处理完成'}
              {isFailed && '处理失败'}
            </span>
            <span className="text-xs text-zinc-500">
              {progress}%
            </span>
          </div>

          {/* 进度条 */}
          <div className="h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
            <motion.div
              className={`h-full ${
                isFailed ? 'bg-red-500' : 
                isCompleted ? 'bg-green-500' : 
                'bg-blue-500'
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          {/* 错误信息 */}
          {isFailed && jobStatus.error && (
            <p className="text-xs text-red-500 mt-1">
              {jobStatus.error}
            </p>
          )}

          {/* 完成提示 */}
          {isCompleted && (
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              现在可以使用 AI 功能了
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
