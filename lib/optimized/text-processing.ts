/**
 * Optimized Text Processing for Next.js 16
 * 基于函数式编程的高性能文本处理
 */

// 文本块分割优化版本
export function splitMarkdownBlocksOptimized(text: string): string[] {
  if (!text?.trim()) return [];
  
  const lines = text.split(/\r?\n/);
  const blocks: string[] = [];
  let currentBlock: string[] = [];
  let inCodeBlock = false;

  // 使用更高效的循环
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 代码块处理
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        currentBlock.push(line);
        blocks.push(currentBlock.join('\n'));
        currentBlock = [];
        inCodeBlock = false;
      } else {
        if (currentBlock.length > 0) {
          blocks.push(currentBlock.join('\n'));
          currentBlock = [];
        }
        inCodeBlock = true;
        currentBlock.push(line);
      }
      continue;
    }

    if (inCodeBlock) {
      currentBlock.push(line);
      continue;
    }

    // 标题处理（独立块）
    if (trimmed.startsWith('#')) {
      if (currentBlock.length > 0) {
        blocks.push(currentBlock.join('\n'));
        currentBlock = [];
      }
      blocks.push(line);
      continue;
    }

    // 水平线处理
    if (/^[-*_]{3,}$/.test(trimmed)) {
      if (currentBlock.length > 0) {
        blocks.push(currentBlock.join('\n'));
        currentBlock = [];
      }
      blocks.push(line);
      continue;
    }

    // 图片处理
    if (/^!\[.*\]\(.*\)$/.test(trimmed)) {
      if (currentBlock.length > 0) {
        blocks.push(currentBlock.join('\n'));
        currentBlock = [];
      }
      blocks.push(line);
      continue;
    }

    // 段落处理
    if (trimmed === '') {
      if (currentBlock.length > 0) {
        blocks.push(currentBlock.join('\n'));
        currentBlock = [];
      }
    } else {
      currentBlock.push(line);
    }
  }

  // 处理最后一个块
  if (currentBlock.length > 0) {
    blocks.push(currentBlock.join('\n'));
  }

  return blocks.filter(block => block.trim().length > 0);
}

// 句子分割优化
export function splitSentencesOptimized(text: string): string[] {
  if (!text?.trim()) return [];
  
  // 使用更精确的正则表达式
  return text
    .replace(/([。！？\n])/g, '$1|')
    .replace(/(\. )/g, '.|')
    .replace(/([!?])\s+/g, '$1|')
    .split('|')
    .filter(sentence => sentence.trim().length > 0);
}

// 智能文本分块（语义感知）
export function chunkTextSemantically(
  text: string, 
  chunkSize: number = 800, 
  overlap: number = 100
): string[] {
  if (!text?.trim()) return [];
  
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
  
  let currentChunk = "";

  for (const paragraph of paragraphs) {
    const trimmedPara = paragraph.trim();
    if (!trimmedPara) continue;

    // 如果添加段落后超出大小限制
    if (currentChunk.length + trimmedPara.length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      
      // 计算重叠部分
      const words = currentChunk.split(/\s+/);
      const overlapWords = Math.min(overlap, Math.floor(words.length * 0.3));
      const overlapStart = Math.max(0, words.length - overlapWords);
      const overlapText = words.slice(overlapStart).join(' ');
      
      currentChunk = overlapText + "\n\n" + trimmedPara;
    } else {
      currentChunk += (currentChunk ? "\n\n" : "") + trimmedPara;
    }

    // 处理超大段落
    while (currentChunk.length > chunkSize * 1.5) {
      let splitPoint = currentChunk.lastIndexOf('\n', chunkSize);
      if (splitPoint === -1 || splitPoint < chunkSize * 0.5) {
        splitPoint = currentChunk.lastIndexOf('. ', chunkSize);
      }
      if (splitPoint === -1 || splitPoint < chunkSize * 0.3) {
        splitPoint = chunkSize;
      }
      
      const chunk = currentChunk.slice(0, splitPoint);
      chunks.push(chunk.trim());
      
      const overlapStart = Math.max(0, splitPoint - overlap);
      currentChunk = currentChunk.slice(overlapStart);
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

// 文本质量分析
export function analyzeTextQuality(text: string): {
  readability: number;
  complexity: number;
  structure: number;
  overall: number;
} {
  if (!text?.trim()) {
    return { readability: 0, complexity: 0, structure: 0, overall: 0 };
  }

  const sentences = splitSentencesOptimized(text);
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);

  // 可读性评分（基于平均句子长度）
  const avgSentenceLength = words.length / sentences.length;
  const readability = Math.max(0, Math.min(1, 1 - Math.abs(avgSentenceLength - 15) / 30));

  // 复杂度评分（基于词汇多样性）
  const uniqueWords = new Set(words.map(w => w.toLowerCase()));
  const complexity = Math.min(1, uniqueWords.size / words.length * 2);

  // 结构评分（段落和标题）
  const hasHeadings = /#{1,6}\s/.test(text);
  const hasLists = /[\-\*\+]\s|^[\d]+\.\s/.test(text);
  const structure = (hasHeadings ? 0.4 : 0) + (hasLists ? 0.3 : 0) + 
                   (paragraphs.length > 1 ? 0.3 : 0);

  const overall = (readability * 0.4 + complexity * 0.3 + structure * 0.3);

  return {
    readability: Math.round(readability * 100) / 100,
    complexity: Math.round(complexity * 100) / 100,
    structure: Math.round(structure * 100) / 100,
    overall: Math.round(overall * 100) / 100
  };
}

// 文本清理优化
export function cleanTextOptimized(text: string): string {
  if (!text) return '';
  
  return text
    .trim()
    .replace(/\r\n/g, '\n')                    // 统一换行符
    .replace(/\r/g, '\n')
    .replace(/\t/g, '  ')                      // 制表符转空格
    .replace(/[ \t]+$/gm, '')                  // 行尾空白
    .replace(/\n{3,}/g, '\n\n')                // 多余空行
    .replace(/^\s*[-*+]\s*$/gm, '')            // 空列表项
    .replace(/```[ \t]*\n/g, '```\n')          // 代码块清理
    .replace(/\n[ \t]*```/g, '\n```')          // 代码块清理
    .replace(/[ \t]{2,}/g, ' ');               // 多余空格
}

// 性能监控装饰器
export function withPerformanceMonitoring<T extends (...args: any[]) => any>(
  fn: T,
  name: string
): T {
  return function(...args: Parameters<T>): ReturnType<T> {
    const start = performance.now();
    const result = fn(...args);
    
    // 异步函数处理
    if (result instanceof Promise) {
      return result.then(res => {
        console.log(`${name} took ${performance.now() - start}ms`);
        return res;
      }) as ReturnType<T>;
    }
    
    console.log(`${name} took ${performance.now() - start}ms`);
    return result;
  } as T;
}
