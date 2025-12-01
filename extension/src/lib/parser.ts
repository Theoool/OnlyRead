import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

export interface ParsedContent {
  title: string;
  content: string;
  byline: string;
  siteName: string;
}

export function parseDocument(doc: Document): ParsedContent | null {
  // Clone to avoid modifying original
  const clone = doc.cloneNode(true) as Document;
  const reader = new Readability(clone);
  const article = reader.parse();

  if (!article) return null;

  // Convert HTML to Markdown
  const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    hr: '---',
    bulletListMarker: '-',
  });
  
  turndownService.use(gfm);

  // Cleanup HTML before conversion (similar to our API route)
  let html = article.content;
  
  // Resolve relative URLs
  const baseUrl = new URL(doc.baseURI);
  html = html.replace(/(src|href)=["']([^"']+)["']/gi, (match, attr, path) => {
    try {
      const absolute = new URL(path, baseUrl).href;
      return `${attr}="${absolute}"`;
    } catch {
      return match;
    }
  });

  const markdown = turndownService.turndown(html);

  return {
    title: article.title,
    content: markdown,
    byline: article.byline || '',
    siteName: article.siteName || '',
  };
}
