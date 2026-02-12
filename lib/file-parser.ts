import EPub from 'epub2';
import TurndownService from 'turndown';

// 动态导入 pdfjs-dist 以避免服务端加载原生 canvas 模块
// 只在实际需要解析 PDF 时才导入
let pdfjsLib: typeof import('pdfjs-dist/legacy/build/pdf.js') | null = null;

async function getPdfJs() {
  if (!pdfjsLib) {
    pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.js');
  }
  return pdfjsLib;
}

// 条件导入Node.js模块 - 仅在服务端可用
let fs: typeof import('fs/promises') | null = null;
let path: typeof import('path') | null = null;
let os: typeof import('os') | null = null;

if (typeof window === 'undefined') {
  // 服务端环境
  fs = require('fs/promises');
  path = require('path');
  os = require('os');
}

export interface ParsedChapter {
  title: string;
  content: string; // Markdown
  order: number;
}

export interface ParsedBook {
  title: string;
  author?: string;
  description?: string;
  chapters: ParsedChapter[];
  failedChapters?: { id: string; error: string }[];
}

export class FileParser {
  private turndown: TurndownService;

  constructor() {
    this.turndown = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      hr: '---',
      bulletListMarker: '-',
    });
    
    // 保留图片的自定义规则
    this.turndown.addRule('images', {
      filter: 'img',
      replacement: (_, node) => {
        const img = node as HTMLImageElement;
        return `![${img.alt || ''}](${img.src || ''})`;
      }
    });
  }

  /**
   * Parse EPUB file
   * @param fileBuffer The buffer of the EPUB file
   */
  async parseEpub(fileBuffer: Buffer): Promise<ParsedBook> {
    // 确保在服务端环境中运行
    if (!fs || !path || !os) {
      throw new Error('EPUB解析只能在服务端环境中运行');
    }

    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `upload-${Date.now()}.epub`);

    try {
      await fs.writeFile(tempFilePath, fileBuffer);

      // Cast to any because epub2 types are often incomplete
      const epub = await EPub.createAsync(tempFilePath) as any;

      const book: ParsedBook = {
        title: epub.metadata.title || 'Untitled Book',
        author: epub.metadata.creator,
        description: epub.metadata.description,
        chapters: [],
        failedChapters: [],
      };

      let order = 0;
      // epub.flow guarantees reading order
      for (const chapterRef of epub.flow) {
        if (!chapterRef.id) continue;

        try {
          const chapterText = await new Promise<string>((resolve, reject) => {
            epub.getChapter(chapterRef.id, (err: any, text: string) => {
              if (err) reject(err);
              else resolve(text);
            });
          });

          if (chapterText) {
            const markdown = this.turndown.turndown(chapterText);

            // Filter out empty or extremely short chapters (e.g., copyright pages with no real content)
            // Threshold: < 50 chars and no images
            if (markdown.length < 50 && !markdown.includes('![')) {
              // Check if it's a "junk" chapter
              const lowerMd = markdown.toLowerCase();
              if (lowerMd.includes('copyright') || lowerMd.includes('版权') || !markdown.trim()) {
                continue;
              }
            }

            // Try to use the title from the manifest/TOC if available, otherwise ID
            let title = chapterRef.title || chapterRef.id;

            // Improve title if it's just an ID
            if (title === chapterRef.id) {
              // Try to extract first heading from markdown
              const match = markdown.match(/^#\s+(.+)$/m);
              if (match) {
                title = match[1].trim();
              }
            }

            // Clean up title: remove asterisks, excessive spaces, and non-printable chars
            title = title
              .replace(/\*+/g, '')        // Remove markdown bold asterisks
              .replace(/\s+/g, ' ')       // Normalize spaces
              .replace(/[^\x20-\x7E\u4e00-\u9fa5]/g, '') // Keep basic ASCII and Chinese chars, remove controls
              .trim();

            book.chapters.push({
              title: title,
              content: markdown,
              order: order++,
            });
          }
        } catch (err: any) {
          console.error(`Failed to parse chapter ${chapterRef.id}:`, err);
          book.failedChapters?.push({
            id: chapterRef.id,
            error: err.message || String(err),
          });
        }
      }

      return book;

    } finally {
      try {
        await fs.unlink(tempFilePath);
      } catch (e) {
        // ignore cleanup errors
      }
    }
  }

  /**
   * Parse PDF file
   * Uses page-by-page extraction to create manageable chapters.
   */
  async parsePdf(fileBuffer: Buffer): Promise<ParsedBook> {
    const pdfjs = await getPdfJs();
    const uint8Array = new Uint8Array(fileBuffer);

    const loadingTask = pdfjs.getDocument({
      data: uint8Array,
      isEvalSupported: false,
    });

    // @ts-ignore
    const doc = await loadingTask.promise;
    const numPages = doc.numPages;
    const pages: string[] = [];

    for (let i = 1; i <= numPages; i++) {
      const page = await doc.getPage(i);
      const textContent = await page.getTextContent();

      let lastY, text = '';
      const items = textContent.items as any[];

      for (const item of items) {
        if ('str' in item) {
          // transform[5] is the Y position
          if (lastY == item.transform[5] || !lastY) {
            text += item.str;
          } else {
            text += '\n' + item.str;
          }
          lastY = item.transform[5];
        }
      }
      pages.push(text);
    }

    // Determine metadata
    let title = 'Uploaded PDF';
    let author = '';

    try {
      const meta = await doc.getMetadata();
      if (meta && meta.info) {
        // @ts-ignore
        if (meta.info.Title) title = meta.info.Title;
        // @ts-ignore
        if (meta.info.Author) author = meta.info.Author;
      }
    } catch (e) {
      console.warn("Failed to get PDF metadata", e);
    }

    // Group pages into chapters
    const CHARS_PER_CHAPTER = 4000;
    const chapters: ParsedChapter[] = [];

    let currentChapterContent = '';
    let currentStartPage = 1;
    let order = 0;

    for (let i = 0; i < pages.length; i++) {
      const pageText = pages[i];

      if (currentChapterContent.length > 0) {
        currentChapterContent += '\n\n---\n\n';
      }
      currentChapterContent += pageText;

      if (currentChapterContent.length >= CHARS_PER_CHAPTER || i === pages.length - 1) {
        chapters.push({
          title: `Pages ${currentStartPage} - ${i + 1}`,
          content: currentChapterContent,
          order: order++,
        });

        currentChapterContent = '';
        currentStartPage = i + 2;
      }
    }

    return {
      title,
      author,
      chapters
    };
  }
}
