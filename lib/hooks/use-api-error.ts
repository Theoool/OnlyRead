import { useEffect } from 'react';
import { toast } from 'sonner';

interface APIError {
  error: string;
  code: string;
  details?: any;
}

/**
 * Unified API Error Handler
 * Displays appropriate error messages to users
 */
export function useApiError() {
  const handleError = (error: unknown, context?: string) => {
    console.error('[API Error]', context, error);

    // API Error response
    if (typeof error === 'object' && error !== null && 'error' in error) {
      const apiError = error as APIError;

      // Map error codes to user-friendly messages
      const errorMessages: Record<string, string> = {
        VALIDATION_ERROR: '请检查输入内容',
        UNAUTHORIZED: '请先登录',
        FORBIDDEN: '没有权限访问',
        NOT_FOUND: '资源不存在',
        CONFLICT: '数据冲突，请刷新页面重试',
        FILE_TOO_LARGE: apiError.details?.maxSize
          ? `文件过大，最大${apiError.details.maxSize}`
          : '文件过大',
        UNSUPPORTED_FORMAT: apiError.details?.supportedFormats
          ? `不支持的格式，支持：${apiError.details.supportedFormats.join(', ')}`
          : '不支持的文件格式',
        DATABASE_ERROR: '数据库错误，请稍后重试',
        EXTERNAL_SERVICE_ERROR: '外部服务错误，请稍后重试',
        INTERNAL_SERVER_ERROR: '服务器错误，请稍后重试',
        NETWORK_ERROR: '网络连接失败，请检查网络',
      };

      const message = errorMessages[apiError.code] || apiError.error;
      toast.error(message);
      return;
    }

    // Standard Error
    if (error instanceof Error) {
      toast.error(error.message || '操作失败');
      return;
    }

    // Unknown error
    toast.error('操作失败，请稍后重试');
  };

  return { handleError };
}

/**
 * Hook to automatically handle errors in useEffect
 */
export function useErrorHandler(error: unknown, context?: string) {
  const { handleError } = useApiError();

  useEffect(() => {
    if (error) {
      handleError(error, context);
    }
  }, [error, handleError, context]);
}
