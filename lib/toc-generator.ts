/**
 * Table of Contents Generator
 * Extracts and structures headings from Markdown content
 */

export interface TOCItem {
  id: string;
  title: string;
  level: number;  // 1-6
  children?: TOCItem[];
  startPosition: number;  // Character position in content
  headingIndex: number;   // Order in the document
}

export interface TOCWithMetadata {
  items: TOCItem[];
  totalHeadings: number;
  maxLevel: number;
  estimatedReadTime: number;
}

/**
 * Generate Table of Contents from Markdown content
 */
export function generateTOC(markdown: string): TOCWithMetadata {
  const items: TOCItem[] = [];
  const lines = markdown.split('\n');
  let currentPosition = 0;
  let headingIndex = 0;
  let maxLevel = 1;

  // Stack to manage nested headings
  const stack: { level: number; items: TOCItem[] }[] = [{ level: 0, items }];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

    if (headingMatch) {
      const level = headingMatch[1].length;
      const title = headingMatch[2].trim();
      const id = `heading-${headingIndex}`;

      const tocItem: TOCItem = {
        id,
        title,
        level,
        startPosition: currentPosition,
        headingIndex: headingIndex++,
      };

      // Update max level
      if (level > maxLevel) maxLevel = level;

      // Find the correct parent level
      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }

      // Add to parent's children or root
      const parent = stack[stack.length - 1];
      if (parent.level === 0) {
        items.push(tocItem);
      } else {
        // Find the last item at parent level
        const lastItem = findLastItemAtLevel(parent.items, parent.level);
        if (lastItem) {
          if (!lastItem.children) lastItem.children = [];
          lastItem.children.push(tocItem);
        } else {
          parent.items.push(tocItem);
        }
      }

      // Push current level to stack
      stack.push({ level, items: parent.level === 0 ? items : (findLastItemAtLevel(parent.items, parent.level)?.children || []) });
    }

    // Update position
    currentPosition += line.length + 1; // +1 for newline
  }

  // Estimate read time (rough estimate: 200 words per minute)
  const wordCount = markdown.split(/\s+/).length;
  const estimatedReadTime = Math.ceil(wordCount / 200);

  return {
    items,
    totalHeadings: headingIndex,
    maxLevel,
    estimatedReadTime,
  };
}

/**
 * Find the last item at a specific level
 */
function findLastItemAtLevel(items: TOCItem[], level: number): TOCItem | null {
  for (let i = items.length - 1; i >= 0; i--) {
    if (items[i].level === level) {
      return items[i];
    }
    if (items[i].children) {
      const found = findLastItemAtLevel(items[i].children!, level);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Find the sentence index that corresponds to a TOC item position
 */
export function findSentenceForPosition(
  sentences: string[],
  position: number
): number {
  let currentPos = 0;
  for (let i = 0; i < sentences.length; i++) {
    currentPos += sentences[i].length;
    if (currentPos >= position) {
      return i;
    }
  }
  return 0;
}

/**
 * Flatten TOC tree for rendering
 */
export function flattenTOC(items: TOCItem[], level = 0): (TOCItem & { flattenLevel: number })[] {
  const result: (TOCItem & { flattenLevel: number })[] = [];

  for (const item of items) {
    result.push({ ...item, flattenLevel: level });
    if (item.children) {
      result.push(...flattenTOC(item.children, level + 1));
    }
  }

  return result;
}

/**
 * Generate a simple TOC (flat list with indentation)
 */
export function generateSimpleTOC(markdown: string): Array<{
  title: string;
  level: number;
  index: number;
  flattenLevel?: number;
}> {
  const { items } = generateTOC(markdown);
  return flattenTOC(items);
}
