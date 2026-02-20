/**
 * 服务端文件处理模块
 * Server-side File Processing Module
 * 专门用于服务端环境的文件解析，避免客户端导入Node.js原生模块
 */

import { FileParser } from '@/lib/file-parser';
import { ProcessedBook, ProcessedChapter } from '@/lib/types/processed-book';

/**
 * 服务端文件处理器
 * 专门为服务端环境设计，避免客户端构建错误
 */
export class ServerFileProcessor {
  private static instance: ServerFileProcessor;
  private fileParser: FileParser;

  private constructor() {
    this.fileParser = new FileParser();
  }

  static getInstance(): ServerFileProcessor {
    if (!ServerFileProcessor.instance) {
      ServerFileProcessor.instance = new ServerFileProcessor();
    }
    return ServerFileProcessor.instance;
  }

  /**
   * 处理EPUB文件（仅服务端）
   */
  async processEpub(buffer: Buffer, fileName: string): Promise<ProcessedBook> {
    try {
      console.log('开始处理EPUB文件:', fileName);
      const result = await this.fileParser.parseEpub(buffer);
      console.log('EPUB解析结果:', {
        title: result.title,
        chaptersCount: result.chapters?.length || 0,
        hasChapters: !!result.chapters,
        failedChapters: result.failedChapters?.length || 0
      });
      
      // 转换为ProcessedBook格式
      const processedBook: ProcessedBook = {
        title: result.title,
        author: result.author,
        description: result.description,
        chapters: result.chapters?.map(chapter => ({
          title: chapter.title,
          content: chapter.content,
          order: chapter.order,
          wordCount: chapter.content.split(/\s+/).length,
          readingTime: Math.ceil(chapter.content.length / 400)
        })) || [],
        failedChapters: result.failedChapters,
        metadata: {
          processedBy: 'server-legacy-architecture',
          processingTimestamp: Date.now(),
          fileName: fileName
        },
        performance: {
          parsingTime: 0, // 旧架构不提供详细性能数据
          conversionTime: 0,
          totalTime: 0
        }
      };

      console.log('处理后的书籍数据:', {
        title: processedBook.title,
        chaptersCount: processedBook.chapters.length,
        hasContent: processedBook.chapters.some(ch => ch.content?.length > 0)
      });

      return processedBook;
    } catch (error) {
      console.error('服务端EPUB处理失败:', error);
      throw error;
    }
  }

  /**
   * 处理PDF文件（仅服务端）
   */
  async processPdf(buffer: Buffer, fileName: string): Promise<ProcessedBook> {
    try {
      const result = await this.fileParser.parsePdf(buffer);
      
      const processedBook: ProcessedBook = {
        title: result.title,
        author: result.author,
        description: result.description,
        chapters: result.chapters.map(chapter => ({
          title: chapter.title,
          content: chapter.content,
          order: chapter.order,
          wordCount: chapter.content.split(/\s+/).length,
          readingTime: Math.ceil(chapter.content.length / 400)
        })),
        failedChapters: result.failedChapters,
        metadata: {
          processedBy: 'server-legacy-architecture',
          processingTimestamp: Date.now(),
          fileName: fileName
        },
        performance: {
          parsingTime: 0,
          conversionTime: 0,
          totalTime: 0
        }
      };

      return processedBook;
    } catch (error) {
      console.error('服务端PDF处理失败:', error);
      throw error;
    }
  }

  /**
   * 处理文本文件
   */
  async processText(content: string, fileName: string): Promise<ProcessedBook> {
    const processedBook: ProcessedBook = {
      title: fileName.replace(/\.[^/.]+$/, ''),
      chapters: [{
        title: fileName,
        content: content,
        order: 0,
        wordCount: content.split(/\s+/).length,
        readingTime: Math.ceil(content.length / 400)
      }],
      metadata: {
        fileType: 'text',
        processedBy: 'server-legacy-architecture',
        processingTimestamp: Date.now(),
        fileName: fileName
      },
      performance: {
        parsingTime: 0,
        conversionTime: 0,
        totalTime: 0
      }
    };

    return processedBook;
  }
}

// 服务端处理函数
export async function processFileOnServer(buffer: Buffer, fileName: string): Promise<ProcessedBook> {
  const processor = ServerFileProcessor.getInstance();
  
  const isEpub = fileName.toLowerCase().endsWith('.epub');
  const isPdf = fileName.toLowerCase().endsWith('.pdf');
  const isText = fileName.toLowerCase().endsWith('.txt') || fileName.toLowerCase().endsWith('.md');
  
  if (isEpub) {
    return await processor.processEpub(buffer, fileName);
  } else if (isPdf) {
    return await processor.processPdf(buffer, fileName);
  } else if (isText) {
    const content = buffer.toString('utf-8');
    return await processor.processText(content, fileName);
  } else {
    throw new Error(`不支持的文件格式: ${fileName}`);
  }
}
