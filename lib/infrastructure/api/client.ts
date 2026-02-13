/**
 * Unified API client for cloud-first architecture
 * All data operations go through this client
 */

// Custom error class for API errors
export class APIError extends Error {
  constructor(
    message: string,
    public code: string,
    public status?: number
  ) {
    super(message)
    this.name = 'APIError'
  }
}

// 防止频繁重定向的节流变量
let redirectTimeout: NodeJS.Timeout | null = null;

/**
 * Wrapper for fetch API with unified error handling
 */
export async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  try {
    const response = await fetch(endpoint, {
      ...options,
      credentials: 'include', // Important: Include cookies for authentication
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })

    // Handle 401 Unauthorized - redirect to login with debouncing
    if (response.status === 401) {
      if (typeof window !== 'undefined') {
        // 清除之前的定时器
        if (redirectTimeout) {
          clearTimeout(redirectTimeout);
        }
        
        // 设置新的重定向定时器（防抖）
        redirectTimeout = setTimeout(() => {
          window.location.href = '/auth?redirect=' + encodeURIComponent(window.location.pathname);
        }, 100); // 100ms 防抖延迟
      }
      throw new APIError('Unauthorized. Please login.', 'UNAUTHORIZED', 401)
    }

    // Handle other errors
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new APIError(
        error.error || error.message || 'Request failed',
        error.code || 'API_ERROR',
        response.status
      )
    }

    const data = await response.json()
    return data as T
  } catch (error) {
    if (error instanceof APIError) {
      throw error
    }

    // Network errors or other issues
    throw new APIError(
      error instanceof Error ? error.message : 'Network error',
      'NETWORK_ERROR'
    )
  }
}

/**
 * GET request wrapper
 */
export function get<T>(endpoint: string): Promise<T> {
  return apiRequest<T>(endpoint, { method: 'GET' })
}

/**
 * POST request wrapper
 */
export function post<T>(endpoint: string, data?: any): Promise<T> {
  return apiRequest<T>(endpoint, {
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  })
}

/**
 * PUT request wrapper
 */
export function put<T>(endpoint: string, data?: any): Promise<T> {
  return apiRequest<T>(endpoint, {
    method: 'PUT',
    body: data ? JSON.stringify(data) : undefined,
  })
}

/**
 * DELETE request wrapper
 */
export function del<T>(endpoint: string): Promise<T> {
  return apiRequest<T>(endpoint, { method: 'DELETE' })
}
