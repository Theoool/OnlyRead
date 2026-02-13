/**
 * Next.js Server Actions - 内容提取 API
 * 使用 Next.js 16 的 Server Actions 特性
 */

'use server';

import { extractFromUrl, extractFromHtml, extractBatch } from '../server';
import type { ExtractedContent, ExtractionOptions, BatchExtractionResult } from '../core/types';

/**
 * Server Action: 从 URL 提取内容
 */
export async function extractContentFromUrl(
  url: string,
  options?: ExtractionOptions
): Promise<ExtractedContent> {
  try {
    return await extractFromUrl(url, options);
  } catch (error) {
    throw new Error(`内容提取失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Server Action: 从 HTML 提取内容
 */
export async function extractContentFromHtml(
  html: string,
  url?: string,
  options?: ExtractionOptions
): Promise<ExtractedContent> {
  try {
    return await extractFromHtml(html, url, options);
  } catch (error) {
    throw new Error(`内容提取失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Server Action: 批量提取内容
 */
export async function extractContentBatch(
  urls: string[],
  options?: ExtractionOptions
): Promise<BatchExtractionResult> {
  try {
    return await extractBatch(urls, options);
  } catch (error) {
    throw new Error(`批量提取失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Server Action: 验证 URL 是否可访问
 */
export async function validateUrl(url: string): Promise<{
  valid: boolean;
  status?: number;
  error?: string;
}> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ContentExtractor/2.0)',
      },
    });

    return {
      valid: response.ok,
      status: response.status,
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

