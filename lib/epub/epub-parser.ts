import EPub from 'epub2';
import TurndownService from 'turndown';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';
import { pipeline } from 'stream/promises';

interface ParsedBook {
  title: string;
  author?: string | string[];
  description?: string;
  chapters: Chapter[];
  failedChapters: FailedChapter[];
  metadata: BookMetadata;
}

interface Chapter {
  title: string;
  content: string;
  order: number;
  wordCount: number; // 新增：便于后续处理
}

interface FailedChapter {
  id: string;
  error: string;
  rawError?: any;
}

interface BookMetadata {
  language?: string;
  publisher?: string;
  publishedDate?: string;
  isbn?: string;
  coverImage?: Buffer; // 可选：提取封面
}

export class EpubParser {
  private turndown: TurndownService;
  
  constructor() {
    this.turndown = new TurndownService({
      headingStyle: 'atx',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
    });
    
    // 自定义规则：保留图片
    this.turndown.addRule('keepImages', {
      filter: 'img',
      replacement: (content, node) => {
        const src = (node as any).getAttribute('src') || '';
        const alt = (node as any).getAttribute('alt') || '';
        return `![${alt}](${src})`;
      }
    });
  }

  async parseEpub(fileBuffer: Buffer): Promise<ParsedBook> {
    const tempFilePath = await this.createTempFile(fileBuffer);
    let epub: any;
    
    try {
      epub = await EPub.createAsync(tempFilePath);
      
      const metadata = this.extractMetadata(epub);
      const chapters = await this.processChapters(epub);
      
      return {
        ...metadata,
        chapters: chapters.successful,
        failedChapters: chapters.failed,
        metadata: {
          language: epub.metadata?.language,
          // 其他元数据...
        }
      };
      
    } finally {
      await this.cleanup(tempFilePath, epub);
    }
  }

  private async createTempFile(buffer: Buffer): Promise<string> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'epub-'));
    const tempPath = path.join(tempDir, `book-${Date.now()}.epub`);
    await fs.writeFile(tempPath, buffer);
    return tempPath;
  }

  private extractMetadata(epub: any): Pick<ParsedBook, 'title' | 'author' | 'description'> {
    const meta = epub.metadata || {};
    
    // 处理作者可能是数组的情况
    const author = Array.isArray(meta.creator) 
      ? meta.creator.join(', ') 
      : meta.creator;
    
    return {
      title: meta.title || 'Untitled Book',
      author: author || 'Unknown Author',
      description: meta.description,
    };
  }

  private async processChapters(epub: any): Promise<{
    successful: Chapter[];
    failed: FailedChapter[];
  }> {
    const flow = epub.flow || [];
    const successful: Chapter[] = [];
    const failed: FailedChapter[] = [];
    
    // 使用 Promise.allSettled 并行处理，但控制并发
    const CONCURRENCY = 5;
    const chunks = this.chunkArray(flow, CONCURRENCY);
    
    for (const batch of chunks) {
      const results = await Promise.allSettled(
        batch.map((ref, idx) => this.processSingleChapter(epub, ref, successful.length + idx))
      );
      
      results.forEach((result, idx) => {
        const chapterRef = batch[idx];
        if (result.status === 'fulfilled' && result.value) {
          successful.push(result.value);
        } else {
          failed.push({
            id: chapterRef.id || 'unknown',
            error: result.status === 'rejected' 
              ? result.reason?.message || String(result.reason)
              : 'Empty chapter content',
            rawError: result.status === 'rejected' ? result.reason : undefined
          });
        }
      });
    }
    
    // 按原始顺序排序
    successful.sort((a, b) => a.order - b.order);
    
    return { successful, failed };
  }

  private async processSingleChapter(
    epub: any, 
    chapterRef: any, 
    order: number
  ): Promise<Chapter | null> {
    if (!chapterRef.id) return null;

    const html = await new Promise<string>((resolve, reject) => {
      epub.getChapter(chapterRef.id, (err: any, text: string) => {
        err ? reject(err) : resolve(text || '');
      });
    });

    if (!html.trim()) return null;

    const markdown = this.turndown.turndown(html);
    
    if (this.shouldSkipChapter(markdown)) {
      return null;
    }

    const title = this.extractTitle(chapterRef, markdown, order);
    const wordCount = markdown.split(/\s+/).length;

    return {
      title,
      content: markdown,
      order,
      wordCount,
    };
  }

  private shouldSkipChapter(markdown: string): boolean {
    const trimmed = markdown.trim();
    if (trimmed.length === 0) return true;
    
    // 保留有图片的短内容
    if (trimmed.length < 50 && trimmed.includes('![')) return false;
    
    // 检测版权页
    const sample = trimmed.slice(0, 300).toLowerCase();
    const junkPatterns = [
      /copyright\s+©/i,
      /all\s+rights\s+reserved/i,
      /isbn[:\s]+\d/i,
      /版[权權]所有/,
      /著作[权權]/
    ];
    
    return junkPatterns.some(p => p.test(sample)) && trimmed.length < 500;
  }

  private extractTitle(chapterRef: any, markdown: string, fallback: number): string {
    // 实现见上文
    return `Chapter ${fallback + 1}`; // 简化示例
  }

  private chunkArray<T>(arr: T[], size: number): T[][] {
    return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
      arr.slice(i * size, i * size + size)
    );
  }

  private async cleanup(tempPath: string, epub?: any): Promise<void> {
    // 关闭 epub 文件句柄
    if (epub?.close) {
      await new Promise(resolve => epub.close(resolve));
    }
    
    // 删除临时文件和目录
    try {
      await fs.unlink(tempPath);
      await fs.rmdir(path.dirname(tempPath)); // 删除创建的临时目录
    } catch (e) {
      // 忽略清理错误
    }
  }
}
