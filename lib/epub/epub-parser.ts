import JSZip from 'jszip';
import DOMPurify from 'dompurify';

export interface EpubChapter {
  id: string;
  title: string;
  content: string; // HTML content
  href: string;
}

export interface EpubBook {
  metadata: {
    title: string;
    creator?: string;
    language?: string;
    description?: string;
  };
  chapters: EpubChapter[];
  cover?: string; // Blob URL
}

export class EpubParser {
  private zip: JSZip;
  private basePath: string = '';
  private opfPath: string = '';
  private manifest: Record<string, { href: string; mediaType: string }> = {};
  private spine: string[] = [];
  private resources: Record<string, string> = {}; // href -> Blob URL

  constructor() {
    this.zip = new JSZip();
  }

  async parse(data: ArrayBuffer): Promise<EpubBook> {
    this.zip = await JSZip.loadAsync(data);

    // 1. Find OPF
    await this.findOpfPath();

    // 2. Parse OPF (Manifest & Spine)
    const opfContent = await this.readText(this.opfPath);
    await this.parseOpf(opfContent);

    // 3. Process Resources (Images, CSS) - Create Blobs
    await this.processResources();

    // 4. Parse Content (Chapters)
    const chapters = await this.parseChapters();

    // 5. Metadata
    const metadata = await this.parseMetadata(opfContent);

    return {
      metadata,
      chapters,
    };
  }

  private async findOpfPath() {
    const container = await this.zip.file('META-INF/container.xml')?.async('text');
    if (!container) throw new Error('Invalid EPUB: No container.xml');

    const parser = new DOMParser();
    const doc = parser.parseFromString(container, 'application/xml');
    const rootfile = doc.querySelector('rootfile');
    if (!rootfile) throw new Error('Invalid EPUB: No rootfile');

    this.opfPath = rootfile.getAttribute('full-path') || '';
    // Base path is the directory containing the OPF
    const lastSlash = this.opfPath.lastIndexOf('/');
    this.basePath = lastSlash !== -1 ? this.opfPath.substring(0, lastSlash + 1) : '';
  }

  private async readText(path: string): Promise<string> {
    const file = this.zip.file(path);
    if (!file) return '';
    return await file.async('text');
  }

  private async parseOpf(content: string) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'application/xml');

    // Manifest
    const items = Array.from(doc.querySelectorAll('manifest > item'));
    items.forEach(item => {
      const id = item.getAttribute('id')!;
      const href = item.getAttribute('href')!;
      const mediaType = item.getAttribute('media-type')!;
      // Resolve href relative to OPF location
      this.manifest[id] = { href: this.resolvePath(href, this.basePath), mediaType };
    });

    // Spine
    const itemrefs = Array.from(doc.querySelectorAll('spine > itemref'));
    this.spine = itemrefs.map(ref => ref.getAttribute('idref')!).filter(id => this.manifest[id]);
  }

  private async parseMetadata(content: string) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'application/xml');
    
    const title = doc.querySelector('metadata > title')?.textContent || 'Untitled';
    const creator = doc.querySelector('metadata > creator')?.textContent;
    const language = doc.querySelector('metadata > language')?.textContent;
    const description = doc.querySelector('metadata > description')?.textContent;

    return { title, creator: creator || undefined, language: language || undefined, description: description || undefined };
  }

  private async processResources() {
    // Iterate manifest, if image or css, create Blob URL
    for (const id in this.manifest) {
      const item = this.manifest[id];
      const { href, mediaType } = item;
      
      if (mediaType.startsWith('image/') || mediaType === 'text/css') {
        const file = this.zip.file(href);
        if (file) {
          const blob = await file.async('blob');
          const url = URL.createObjectURL(new Blob([blob], { type: mediaType }));
          this.resources[href] = url;
        }
      }
    }
  }

  private async parseChapters(): Promise<EpubChapter[]> {
    const chapters: EpubChapter[] = [];

    for (const id of this.spine) {
      const item = this.manifest[id];
      if (!item) continue;

      let html = await this.readText(item.href);
      if (!html) continue;

      // Process HTML: Replace resource URLs
      html = this.processHtml(html, item.href);

      // Extract Title (if any) or Body
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // Attempt to find a title in h1-h6
      const titleEl = doc.querySelector('h1, h2, h3');
      const title = titleEl ? titleEl.textContent || 'Chapter' : 'Chapter';

      // Get Body content only
      const body = doc.body;
      let content = body ? body.innerHTML : '';

      // Sanitize
      content = DOMPurify.sanitize(content, {
          ADD_TAGS: ['img', 'link'], // Allow images and CSS links
          ADD_ATTR: ['src', 'href', 'rel', 'type']
      });

      chapters.push({
        id,
        title,
        content,
        href: item.href
      });
    }

    return chapters;
  }

  private processHtml(html: string, currentPath: string): string {
    // We need to replace relative paths in src/href with our Blob URLs
    
    // 1. Identify current directory
    const currentDir = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);

    // Simple regex replacement for src="..." and href="..."
    // Note: This is a bit naive but works for most standard EPUBs
    
    // Replace images
    html = html.replace(/(src|href)=["']([^"']+)["']/g, (match, attr, relPath) => {
        // Resolve path relative to current HTML file
        const fullPath = this.resolvePath(relPath, currentDir);
        
        // Check if we have a blob URL for this resource
        if (this.resources[fullPath]) {
            return `${attr}="${this.resources[fullPath]}"`;
        }
        
        return match;
    });

    return html;
  }

  private resolvePath(relPath: string, baseDir: string = ''): string {
    if (relPath.startsWith('/')) return relPath.substring(1); // Absolute in zip?
    
    // Combine baseDir and relPath
    // handle ../
    const parts = (baseDir + relPath).split('/');
    const stack: string[] = [];
    
    for (const part of parts) {
      if (part === '' || part === '.') continue;
      if (part === '..') {
        stack.pop();
      } else {
        stack.push(part);
      }
    }
    
    // If we are resolving against the zip root, we might need to prepend basePath if the item path didn't include it
    // Wait, manifest hrefs are usually relative to OPF.
    // Let's ensure everything is relative to ZIP root.
    
    // Actually, manifest items in parseOpf are already resolved to ZIP root using this.basePath
    // So here, we just need to resolve relative to ZIP root.
    
    // If I call resolvePath inside parseOpf, I pass this.basePath.
    // If I call resolvePath inside processHtml, I pass current HTML's directory (which is already full path from zip root).
    
    return stack.join('/');
  }
}
