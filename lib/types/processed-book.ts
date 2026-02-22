/**
 * 文件处理相关类型定义
 * File Processing Type Definitions
 */

export interface ProcessedChapter {
  title: string;
  content: string; // Markdown
  order: number;
  wordCount?: number;
  readingTime?: number;
}

export interface ProcessedBook {
  title: string;
  author?: string;
  description?: string;
  chapters: ProcessedChapter[];
  failedChapters?: { id: string; error: string }[];
  metadata?: Record<string, any>;
  performance?: {
    parsingTime: number;
    conversionTime: number;
    totalTime: number;
  };
}



