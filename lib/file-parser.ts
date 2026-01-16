import EPub from 'epub2';
import TurndownService from 'turndown';
import * as pdfParse from 'pdf-parse';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

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
    });
  }

  /**
   * Parse EPUB file
   * @param fileBuffer The buffer of the EPUB file
   */
  async parseEpub(fileBuffer: Buffer): Promise<ParsedBook> {
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
             // Try to use the title from the manifest/TOC if available, otherwise ID
             // chapterRef usually has { id, title, href, ... }
             const title = chapterRef.title || chapterRef.id;

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
    const pages: string[] = [];

    // Custom render function to capture text per page
    const renderPage = async (pageData: any) => {
      // Come from pdf-parse/lib/pdf-parse.js default render
      const renderOptions = {
        normalizeWhitespace: true,
        disableCombineTextItems: false
      };
      
      const textContent = await pageData.getTextContent(renderOptions);
      let lastY, text = '';
      
      // Basic text stitching
      for (let item of textContent.items) {
        if (lastY == item.transform[5] || !lastY) {
          text += item.str;
        } else {
          text += '\n' + item.str;
        }
        lastY = item.transform[5];
      }
      
      // Store this page's text
      pages.push(text);
      
      return text;
    };

    const options = {
      pagerender: renderPage
    };

    const parse = (pdfParse as any).default || (pdfParse as any);
    const data = await parse(fileBuffer, options);
    
    // Group pages into chapters to avoid too many small articles
    // e.g., 10 pages per chapter
    const PAGES_PER_CHAPTER = 10;
    const chapters: ParsedChapter[] = [];
    
    for (let i = 0; i < pages.length; i += PAGES_PER_CHAPTER) {
      const chunk = pages.slice(i, i + PAGES_PER_CHAPTER);
      const content = chunk.join('\n\n---\n\n'); // Separate pages visually
      
      chapters.push({
        title: `Pages ${i + 1} - ${Math.min(i + PAGES_PER_CHAPTER, pages.length)}`,
        content: content,
        order: Math.floor(i / PAGES_PER_CHAPTER),
      });
    }

    return {
      title: (data.info && data.info.Title) || 'Uploaded PDF',
      author: (data.info && data.info.Author) || '',
      chapters: chapters
    };
  }
}
