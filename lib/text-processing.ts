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

/**
 * Split text into semantic chunks for embedding
 * Uses a sliding window approach respecting paragraph boundaries where possible
 */
export function chunkText(text: string, chunkSize: number = 600, overlap: number = 100): string[] {
  if (!text) return [];
  const chunks: string[] = [];
  
  // 1. First split by markdown blocks to preserve code/headers
  const blocks = splitMarkdownBlocks(text);
  
  let currentChunk = "";
  
  for (const block of blocks) {
    // If adding this block exceeds chunk size
    if ((currentChunk.length + block.length) > chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        
        // Start new chunk with overlap from end of previous
        // (Simple character overlap)
        const overlapText = currentChunk.slice(-overlap);
        currentChunk = overlapText + "\n\n" + block;
    } else {
        currentChunk += (currentChunk ? "\n\n" : "") + block;
    }
    
    // Handle edge case: Single block is massive (larger than 1.5x chunk size)
    // Force split it
    while (currentChunk.length > chunkSize * 1.5) {
        // Find a convenient break point (newline or space) near chunkSize
        let splitIdx = currentChunk.lastIndexOf('\n', chunkSize);
        if (splitIdx === -1 || splitIdx < chunkSize * 0.5) {
            splitIdx = currentChunk.lastIndexOf(' ', chunkSize);
        }
        if (splitIdx === -1) splitIdx = chunkSize; // Hard break
        
        const chunk = currentChunk.slice(0, splitIdx);
        chunks.push(chunk.trim());
        
        // Keep overlap for next
        const overlapStart = Math.max(0, splitIdx - overlap);
        currentChunk = currentChunk.slice(overlapStart);
    }
  }
  
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}
