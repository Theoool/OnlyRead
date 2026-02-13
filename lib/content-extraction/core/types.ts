/**
 * 核心类型定义 - 内容提取系统
 * 遵循 Next.js 16 + React 18 最佳实践
 */

// ============================================================================
// 基础类型
// ============================================================================

export interface ExtractedContent {
  title: string;
  content: string;
  type: 'markdown' | 'text' | 'html';
  metadata: ContentMetadata;
}

export interface ContentMetadata {
  wordCount: number;
  readingTime: number;
  imageCount: number;
  linkCount: number;
  codeBlockCount: number;
  sourceQuality: 'high' | 'medium' | 'low';
  extractedAt: number;
  extractionMethod: 'jina' | 'readability' | 'browser';
  language?: string;
  author?: string;
  publishedDate?: string;
}

// ============================================================================
// 配置选项
// ============================================================================

export interface ExtractionOptions {
  // 内容过滤
  minContentLength?: number;
  preserveClasses?: string[];
  removeRecommendations?: boolean;
  aggressiveNoiseRemoval?: boolean;
  preserveComments?: boolean;
  preserveRelated?: boolean;
  customSelectors?: string[];
  
  // 提取方法
  useJina?: boolean;
  useBrowserAPI?: boolean;
  
  // 站点规则
  siteSpecificRules?: Map<string, SiteRule>;
  
  // 性能优化
  cacheEnabled?: boolean;
  cacheTtl?: number;
  maxConcurrency?: number;
  streamingEnabled?: boolean;
  
  // 转换选项
  convertToMarkdown?: boolean;
  imageProcessing?: ImageProcessingOptions;
  
  // 回调
  onProgress?: (progress: ExtractionProgress) => void;
  onError?: (error: ExtractionError) => void;
}

export interface SiteRule {
  contentSelector?: string;
  removeSelectors?: string[];
  transform?: (doc: Document) => void;
  contentCallback?: (doc: Document) => void;
  customParser?: (html: string) => string;
}

export interface ImageProcessingOptions {
  preferDataSrc?: boolean;
  resolveRelativeUrls?: boolean;
  addDimensions?: boolean;
  maxWidth?: number;
  lazyLoadSupport?: boolean;
}

// ============================================================================
// 进度和错误处理
// ============================================================================

export interface ExtractionProgress {
  stage: 'fetching' | 'parsing' | 'filtering' | 'converting' | 'complete';
  progress: number; // 0-100
  message?: string;
  currentUrl?: string;
}

export interface ExtractionError {
  code: string;
  message: string;
  url?: string;
  stage?: ExtractionProgress['stage'];
  originalError?: Error;
}

// ============================================================================
// 批量处理
// ============================================================================

export interface BatchExtractionResult {
  successful: ExtractedContent[];
  failed: Array<{ url: string; error: ExtractionError }>;
  totalProcessed: number;
  totalTime: number;
}

// ============================================================================
// 过滤器接口
// ============================================================================

export interface IContentFilter {
  filter(document: Document, options?: FilterOptions): Document;
  postProcessText?(text: string): string;
}

export interface FilterOptions {
  aggressive?: boolean;
  preserveComments?: boolean;
  preserveRelated?: boolean;
  customSelectors?: string[];
  siteSpecificRules?: Map<string, SiteRule>;
}

// ============================================================================
// 提取器接口
// ============================================================================

export interface IContentExtractor {
  extract(input: string | Document, options?: ExtractionOptions): Promise<ExtractedContent>;
  supports(input: string | Document): boolean;
  priority: number; // 优先级，数字越大优先级越高
}

// ============================================================================
// 转换器接口
// ============================================================================

export interface IContentConverter {
  convert(html: string, baseUrl?: string): string;
  getType(): 'markdown' | 'text' | 'html';
}

// ============================================================================
// 缓存接口
// ============================================================================

export interface ICacheStrategy {
  get(key: string): Promise<ExtractedContent | null>;
  set(key: string, value: ExtractedContent, ttl?: number): Promise<void>;
  has(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  size(): Promise<number>;
}

// ============================================================================
// 工具类型
// ============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

// ============================================================================
// 常量
// ============================================================================

export const DEFAULT_EXTRACTION_OPTIONS: Required<Omit<ExtractionOptions, 'onProgress' | 'onError' | 'siteSpecificRules'>> = {
  minContentLength: 500,
  preserveClasses: [],
  removeRecommendations: true,
  aggressiveNoiseRemoval: false,
  preserveComments: false,
  preserveRelated: false,
  customSelectors: [],
  useJina: true,
  useBrowserAPI: false,
  cacheEnabled: true,
  cacheTtl: 3600000, // 1小时
  maxConcurrency: 5,
  streamingEnabled: false,
  convertToMarkdown: true,
  imageProcessing: {
    preferDataSrc: true,
    resolveRelativeUrls: true,
    addDimensions: false,
    maxWidth: 1200,
    lazyLoadSupport: true,
  },
};

export const EXTRACTION_ERRORS = {
  FETCH_FAILED: 'FETCH_FAILED',
  PARSE_FAILED: 'PARSE_FAILED',
  NO_CONTENT: 'NO_CONTENT',
  INVALID_URL: 'INVALID_URL',
  TIMEOUT: 'TIMEOUT',
  UNSUPPORTED_FORMAT: 'UNSUPPORTED_FORMAT',
} as const;

