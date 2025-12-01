export function splitMarkdownBlocks(text: string): string[] {
  if (!text) return [];
  const lines = text.split(/\r?\n/);
  const blocks: string[] = [];
  let currentBlock: string[] = [];
  let inCodeBlock = false;

  const flushBlock = () => {
    if (currentBlock.length > 0) {
      blocks.push(currentBlock.join('\n'));
      currentBlock = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. Handle Code Blocks (Fenced)
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        // End of code block
        currentBlock.push(line);
        flushBlock();
        inCodeBlock = false;
      } else {
        // Start of code block
        flushBlock();
        inCodeBlock = true;
        currentBlock.push(line);
      }
      continue;
    }

    // Inside code block, just accumulate
    if (inCodeBlock) {
      currentBlock.push(line);
      continue;
    }

    // 2. Handle Headers (Always standalone)
    if (trimmed.startsWith('#')) {
      flushBlock();
      blocks.push(line); // Headers are single lines usually
      continue;
    }

    // 3. Handle Horizontal Rules
    if (/^[-*_]{3,}$/.test(trimmed)) {
      flushBlock();
      blocks.push(line);
      continue;
    }

    // 4. Handle Images (Standalone for better viewing)
    if (/^!\[.*\]\(.*\)$/.test(trimmed)) {
      flushBlock();
      blocks.push(line);
      continue;
    }

    // 5. Standard Paragraph/List Logic
    if (trimmed === '') {
      flushBlock();
    } else {
      currentBlock.push(line);
    }
  }

  flushBlock();
  
  return blocks.filter(b => b.trim().length > 0);
}

export function splitSentences(text: string): string[] {
  if (!text) return [];
  // Split by . ! ? \n but keep delimiters
  const replaced = text
    .replace(/([。！？\n])/g, "$1|")
    .replace(/(\. )/g, ".|");
  return replaced.split("|").filter((s) => s.trim().length > 0);
}
