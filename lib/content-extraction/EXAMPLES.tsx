/**
 * 使用示例 - 展示各种使用场景
 */

// ============================================================================
// 示例 1: 基础使用（Server Component）
// ============================================================================

// app/article/[id]/page.tsx
import { extractContentFromUrl } from '@/lib/content-extraction/actions/extract-actions';

export default async function ArticlePage({ params }: { params: { id: string } }) {
  const url = `https://example.com/articles/${params.id}`;
  
  const content = await extractContentFromUrl(url, {
    minContentLength: 500,
    aggressiveNoiseRemoval: true,
    useJina: true,
  });

  return (
    <article>
      <h1>{content.title}</h1>
      <div className="metadata">
        <span>字数: {content.metadata.wordCount}</span>
        <span>阅读时间: {content.metadata.readingTime}分钟</span>
        <span>质量: {content.metadata.sourceQuality}</span>
      </div>
      <div dangerouslySetInnerHTML={{ __html: content.content }} />
    </article>
  );
}

// ============================================================================
// 示例 2: 客户端交互（Client Component）
// ============================================================================

// app/components/ArticleExtractor.tsx
'use client';

import { useState } from 'react';
import { useContentExtraction } from '@/lib/content-extraction/hooks/use-extraction';

export function ArticleExtractor() {
  const [url, setUrl] = useState('');
  const { data, loading, error, progress, extract, reset } = useContentExtraction();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await extract(url, {
      aggressiveNoiseRemoval: true,
      removeRecommendations: true,
    });
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="输入文章 URL"
          className="flex-1 px-4 py-2 border rounded"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !url}
          className="px-6 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          {loading ? '提取中...' : '提取'}
        </button>
        {data && (
          <button
            type="button"
            onClick={reset}
            className="px-4 py-2 bg-gray-500 text-white rounded"
          >
            重置
          </button>
        )}
      </form>

      {progress && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>{progress.message}</span>
            <span>{progress.progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all"
              style={{ width: `${progress.progress}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700">
          错误: {error.message}
        </div>
      )}

      {data && (
        <div className="space-y-4">
          <div className="p-4 bg-green-50 border border-green-200 rounded">
            <h2 className="text-xl font-bold mb-2">{data.title}</h2>
            <div className="flex gap-4 text-sm text-gray-600">
              <span>📝 {data.metadata.wordCount} 字</span>
              <span>⏱️ {data.metadata.readingTime} 分钟</span>
              <span>🖼️ {data.metadata.imageCount} 图片</span>
              <span>🔗 {data.metadata.linkCount} 链接</span>
              <span>💎 {data.metadata.sourceQuality}</span>
            </div>
          </div>
          <div className="prose max-w-none">
            <pre className="whitespace-pre-wrap">{data.content}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 示例 3: 批量提取
// ============================================================================

// app/components/BatchExtractor.tsx
'use client';

import { useState } from 'react';
import { useBatchExtraction } from '@/lib/content-extraction/hooks/use-extraction';

export function BatchExtractor() {
  const [urls, setUrls] = useState<string[]>([]);
  const [inputUrl, setInputUrl] = useState('');
  const { data, loading, progress, extract } = useBatchExtraction();

  const addUrl = () => {
    if (inputUrl && !urls.includes(inputUrl)) {
      setUrls([...urls, inputUrl]);
      setInputUrl('');
    }
  };

  const removeUrl = (url: string) => {
    setUrls(urls.filter(u => u !== url));
  };

  const handleExtract = async () => {
    await extract(urls, {
      maxConcurrency: 3,
      cacheEnabled: true,
      onProgress: (prog) => {
        console.log(`处理进度: ${prog.progress}%`);
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="url"
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          placeholder="添加 URL"
          className="flex-1 px-4 py-2 border rounded"
          onKeyPress={(e) => e.key === 'Enter' && addUrl()}
        />
        <button
          onClick={addUrl}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          添加
        </button>
      </div>

      {urls.length > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">待提取列表 ({urls.length})</h3>
            <button
              onClick={handleExtract}
              disabled={loading}
              className="px-4 py-2 bg-green-500 text-white rounded disabled:opacity-50"
            >
              {loading ? `提取中 ${progress}%` : '开始批量提取'}
            </button>
          </div>
          <ul className="space-y-1">
            {urls.map((url) => (
              <li key={url} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <span className="text-sm truncate flex-1">{url}</span>
                <button
                  onClick={() => removeUrl(url)}
                  className="ml-2 px-2 py-1 text-red-500 hover:bg-red-50 rounded"
                >
                  删除
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {loading && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>批量提取中...</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {data && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded">
              <div className="text-2xl font-bold text-green-600">
                {data.successful.length}
              </div>
              <div className="text-sm text-gray-600">成功</div>
            </div>
            <div className="p-4 bg-red-50 border border-red-200 rounded">
              <div className="text-2xl font-bold text-red-600">
                {data.failed.length}
              </div>
              <div className="text-sm text-gray-600">失败</div>
            </div>
            <div className="p-4 bg-blue-50 border border-blue-200 rounded">
              <div className="text-2xl font-bold text-blue-600">
                {(data.totalTime / 1000).toFixed(2)}s
              </div>
              <div className="text-sm text-gray-600">总耗时</div>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold">提取结果</h3>
            {data.successful.map((content, index) => (
              <details key={index} className="p-4 bg-white border rounded">
                <summary className="cursor-pointer font-medium">
                  {content.title}
                </summary>
                <div className="mt-2 text-sm text-gray-600">
                  <p>字数: {content.metadata.wordCount}</p>
                  <p>质量: {content.metadata.sourceQuality}</p>
                </div>
              </details>
            ))}
            {data.failed.map((failure, index) => (
              <div key={index} className="p-4 bg-red-50 border border-red-200 rounded">
                <p className="font-medium text-red-700">{failure.url}</p>
                <p className="text-sm text-red-600">{failure.error.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 示例 4: 客户端直接提取（当前页面）
// ============================================================================

// app/components/CurrentPageExtractor.tsx
'use client';

import { useClientExtraction } from '@/lib/content-extraction/hooks/use-extraction';

export function CurrentPageExtractor() {
  const { data, loading, extract } = useClientExtraction();

  const handleExtractCurrentPage = async () => {
    await extract(document, {
      aggressiveNoiseRemoval: true,
      convertToMarkdown: true,
    });
  };

  const handleDownload = () => {
    if (!data) return;
    
    const blob = new Blob([data.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.title}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <button
        onClick={handleExtractCurrentPage}
        disabled={loading}
        className="px-4 py-2 bg-purple-500 text-white rounded disabled:opacity-50"
      >
        {loading ? '提取中...' : '提取当前页面'}
      </button>

      {data && (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">{data.title}</h3>
            <button
              onClick={handleDownload}
              className="px-4 py-2 bg-blue-500 text-white rounded text-sm"
            >
              下载 Markdown
            </button>
          </div>
          <div className="p-4 bg-gray-50 rounded">
            <pre className="text-sm whitespace-pre-wrap">{data.content}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 示例 5: 自定义站点规则
// ============================================================================

// app/lib/site-rules.ts
import type { SiteRule } from '@/lib/content-extraction';

export const customSiteRules = new Map<string, SiteRule>([
  // GitHub
  ['github.com', {
    contentSelector: '.markdown-body',
    removeSelectors: ['.gh-header', '.footer'],
  }],
  
  // Medium
  ['medium.com', {
    contentSelector: 'article',
    removeSelectors: ['.metabar', '.postActions'],
    transform: (doc) => {
      // 移除 Medium 的付费墙
      doc.querySelectorAll('[data-testid="paywall"]').forEach(el => el.remove());
    },
  }],
  
  // 知乎
  ['zhihu.com', {
    contentSelector: '.RichContent',
    removeSelectors: ['.ContentItem-actions', '.Recommendations'],
    transform: (doc) => {
      // 展开折叠的内容
      doc.querySelectorAll('.RichContent-inner').forEach(el => {
        el.removeAttribute('style');
      });
    },
  }],
]);

// 使用自定义规则
import { extractContentFromUrl } from '@/lib/content-extraction/actions/extract-actions';
import { customSiteRules } from '@/app/lib/site-rules';

const content = await extractContentFromUrl(url, {
  siteSpecificRules: customSiteRules,
});

