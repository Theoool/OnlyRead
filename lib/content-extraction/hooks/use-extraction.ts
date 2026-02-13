/**
 * React Hooks - 内容提取
 * 使用 React 18 + Next.js 16 最佳实践
 */

'use client';

import { useState, useCallback, useTransition } from 'react';
import { extractContentFromUrl, extractContentFromHtml, extractContentBatch } from '../actions/extract-actions';
import type { ExtractedContent, ExtractionOptions, BatchExtractionResult, ExtractionProgress } from '../core/types';

// ============================================================================
// useContentExtraction - 单个 URL 提取
// ============================================================================

export interface UseContentExtractionResult {
  data: ExtractedContent | null;
  loading: boolean;
  error: Error | null;
  progress: ExtractionProgress | null;
  extract: (url: string, options?: ExtractionOptions) => Promise<void>;
  reset: () => void;
}

export function useContentExtraction(): UseContentExtractionResult {
  const [data, setData] = useState<ExtractedContent | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState<ExtractionProgress | null>(null);
  const [isPending, startTransition] = useTransition();

  const extract = useCallback(async (url: string, options?: ExtractionOptions) => {
    setError(null);
    setProgress({ stage: 'fetching', progress: 0, message: '开始提取...' });

    startTransition(async () => {
      try {
        const result = await extractContentFromUrl(url, {
          ...options,
          onProgress: (prog) => {
            setProgress(prog);
          },
        });
        setData(result);
        setProgress({ stage: 'complete', progress: 100, message: '提取完成' });
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        setProgress(null);
      }
    });
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setProgress(null);
  }, []);

  return {
    data,
    loading: isPending,
    error,
    progress,
    extract,
    reset,
  };
}

// ============================================================================
// useBatchExtraction - 批量提取
// ============================================================================

export interface UseBatchExtractionResult {
  data: BatchExtractionResult | null;
  loading: boolean;
  error: Error | null;
  progress: number;
  extract: (urls: string[], options?: ExtractionOptions) => Promise<void>;
  reset: () => void;
}

export function useBatchExtraction(): UseBatchExtractionResult {
  const [data, setData] = useState<BatchExtractionResult | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState(0);
  const [isPending, startTransition] = useTransition();

  const extract = useCallback(async (urls: string[], options?: ExtractionOptions) => {
    setError(null);
    setProgress(0);

    startTransition(async () => {
      try {
        const result = await extractContentBatch(urls, {
          ...options,
          onProgress: (prog) => {
            setProgress(prog.progress);
          },
        });
        setData(result);
        setProgress(100);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        setProgress(0);
      }
    });
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setProgress(0);
  }, []);

  return {
    data,
    loading: isPending,
    error,
    progress,
    extract,
    reset,
  };
}

// ============================================================================
// useClientExtraction - 客户端直接提取（不通过 Server Action）
// ============================================================================

import { clientExtractor } from '../index';

export interface UseClientExtractionResult {
  data: ExtractedContent | null;
  loading: boolean;
  error: Error | null;
  progress: ExtractionProgress | null;
  extract: (input: string | Document, options?: ExtractionOptions) => Promise<void>;
  reset: () => void;
}

export function useClientExtraction(): UseClientExtractionResult {
  const [data, setData] = useState<ExtractedContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState<ExtractionProgress | null>(null);

  const extract = useCallback(async (input: string | Document, options?: ExtractionOptions) => {
    setLoading(true);
    setError(null);
    setProgress({ stage: 'fetching', progress: 0, message: '开始提取...' });

    try {
      let result: ExtractedContent;

      if (typeof input === 'string') {
        // URL
        result = await clientExtractor.extractFromUrl(input, {
          ...options,
          onProgress: (prog) => {
            setProgress(prog);
          },
        });
      } else {
        // Document
        result = await clientExtractor.extractFromDocument(input, options);
      }

      setData(result);
      setProgress({ stage: 'complete', progress: 100, message: '提取完成' });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setProgress(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setProgress(null);
  }, []);

  return {
    data,
    loading,
    error,
    progress,
    extract,
    reset,
  };
}

