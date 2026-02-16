/**
 * 内容处理器 - 统一的内容清理和验证逻辑
 */

export interface ContentProcessingOptions {
  maxLength?: number;
  preserveImages?: boolean;
  preserveLinks?: boolean;
  removeNullChars?: boolean;
}

export interface ProcessedContent {
  content: string;
  metadata: {
    originalLength: number;
    processedLength: number;
    wasTruncated: boolean;
    totalBlocks: number;
    estimatedReadingTime: number;
  };
  warnings: string[];
}

/**
 * 内容处理器类
 */
export class ContentProcessor {
  private static readonly DEFAULT_MAX_LENGTH = 50000; // 提高到50KB
  private static readonly READING_SPEED = 400; // 字符/分钟

  /**
   * 处理和清理内容
   */
  static process(
    rawContent: string,
    options: ContentProcessingOptions = {}
  ): ProcessedContent {
    const {
      maxLength = this.DEFAULT_MAX_LENGTH,
      preserveImages = true, // 默认保留图片
      preserveLinks = true,  // 默认保留链接
      removeNullChars = true,
    } = options;

    const warnings: string[] = [];
    const originalLength = rawContent.length;
    let content = rawContent;

    // 1. 移除空字符（必须）
    if (removeNullChars) {
      content = content.replace(/\0/g, '');
    }

    // 2. 处理图片（可选）
    if (!preserveImages) {
      const imageCount = (content.match(/!\[.*?\]\(.*?\)/g) || []).length;
      if (imageCount > 0) {
        content = content.replace(/!\[.*?\]\(.*?\)/g, '');
        warnings.push(`已移除 ${imageCount} 个图片引用`);
      }
    }

    // 3. 处理链接（可选）
    if (!preserveLinks) {
      const linkCount = (content.match(/\[.*?\]\(.*?\)/g) || []).length;
      if (linkCount > 0) {
        content = content.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
        warnings.push(`已简化 ${linkCount} 个链接`);
      }
    }

    // 4. 规范化空白字符
    content = content
      .replace(/\n{4,}/g, '\n\n\n') // 最多3个连续换行
      .replace(/[ \t]+$/gm, '') // 移除行尾空格
      .trim();

    // 5. 处理过长内容（智能截断）
    let wasTruncated = false;
    if (content.length > maxLength) {
      content = this.smartTruncate(content, maxLength);
      wasTruncated = true;
      warnings.push(`内容已从 ${originalLength} 字符截断到 ${content.length} 字符`);
    }

    // 6. 计算元数据
    const totalBlocks = content.split(/\n\s*\n/).filter(Boolean).length;
    const estimatedReadingTime = Math.max(1, Math.ceil(content.length / this.READING_SPEED));

    return {
      content,
      metadata: {
        originalLength,
        processedLength: content.length,
        wasTruncated,
        totalBlocks,
        estimatedReadingTime,
      },
      warnings,
    };
  }

  /**
   * 智能截断 - 在段落边界截断
   */
  private static smartTruncate(content: string, maxLength: number): string {
    if (content.length <= maxLength) {
      return content;
    }

    const truncated = content.substring(0, maxLength);
    
    // 尝试在段落边界截断
    const lastParagraph = truncated.lastIndexOf('\n\n');
    if (lastParagraph > maxLength * 0.8) {
      return truncated.substring(0, lastParagraph) + '\n\n... (内容已截断)';
    }

    // 尝试在句子边界截断
    const lastSentence = Math.max(
      truncated.lastIndexOf('。'),
      truncated.lastIndexOf('！'),
      truncated.lastIndexOf('？'),
      truncated.lastIndexOf('.'),
      truncated.lastIndexOf('!'),
      truncated.lastIndexOf('?')
    );
    
    if (lastSentence > maxLength * 0.9) {
      return truncated.substring(0, lastSentence + 1) + '\n\n... (内容已截断)';
    }

    // 否则直接截断
    return truncated + '\n\n... (内容已截断)';
  }

  /**
   * 验证内容
   */
  static validate(content: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!content || content.trim().length === 0) {
      errors.push('内容为空');
    }

    if (content.includes('\0')) {
      errors.push('内容包含空字符');
    }

    if (content.length > 100000) {
      errors.push(`内容过长: ${content.length} 字符`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 安全清理字符串（用于标题等）
   */
  static sanitizeString(str: string, maxLength = 1000): string {
    return str
      .replace(/\0/g, '')
      .replace(/[\r\n\t]+/g, ' ')
      .trim()
      .substring(0, maxLength);
  }
}

