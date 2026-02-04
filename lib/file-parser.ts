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
      for (const item of textContent.items) {
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
    
    // Group pages based on word count (approx 3000-5000 chars per chapter) 
    // instead of fixed page count, to create better reading flow.
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
      
      // Check if we should split
      // We split if content exceeds threshold OR it's the last page
      if (currentChapterContent.length >= CHARS_PER_CHAPTER || i === pages.length - 1) {
        chapters.push({
          title: `Pages ${currentStartPage} - ${i + 1}`,
          content: currentChapterContent,
          order: order++,
        });
        
        // Reset
        currentChapterContent = '';
        currentStartPage = i + 2;
      }
    }

    return {
      title: (data.info && data.info.Title) || 'Uploaded PDF',
      author: (data.info && data.info.Author) || '',
      chapters: chapters
    };
  }
}
