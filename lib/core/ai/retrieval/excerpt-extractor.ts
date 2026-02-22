/**
 * 改进的摘录提取器
 */

export class ExcerptExtractor {
  /**
   * 提取相关摘录（改进版）
   */
  static extract(content: string, query: string, maxLength: number = 300): string {
    if (!content || !query) {
      return content.slice(0, maxLength);
    }

    const contentLower = content.toLowerCase();
    const queryTerms = this.tokenize(query.toLowerCase());

    // 1. 找到所有匹配位置
    const matches = this.findAllMatches(contentLower, queryTerms);

    if (matches.length === 0) {
      // 没有匹配，返回开头
      return this.truncateAtBoundary(content, 0, maxLength);
    }

    // 2. 选择最佳匹配位置（匹配词最多的）
    const bestMatch = this.selectBestMatch(matches, queryTerms.length);

    // 3. 在单词边界截断
    return this.extractAroundPosition(content, bestMatch, maxLength);
  }

  /**
   * 分词
   */
  private static tokenize(text: string): string[] {
    // 简单分词：按空格和标点分割
    return text
      .split(/[\s,，.。!！?？;；:：]+/)
      .filter(t => t.length > 0);
  }

  /**
   * 找到所有匹配位置
   */
  private static findAllMatches(
    content: string,
    queryTerms: string[]
  ): Array<{ position: number; matchCount: number }> {
    const matches: Array<{ position: number; matchCount: number }> = [];
    const windowSize = 200; // 搜索窗口大小

    for (let i = 0; i < content.length - windowSize; i += windowSize / 2) {
      const window = content.slice(i, i + windowSize);
      let matchCount = 0;

      for (const term of queryTerms) {
        if (window.includes(term)) {
          matchCount++;
        }
      }

      if (matchCount > 0) {
        matches.push({ position: i, matchCount });
      }
    }

    return matches;
  }

  /**
   * 选择最佳匹配位置
   */
  private static selectBestMatch(
    matches: Array<{ position: number; matchCount: number }>,
    totalTerms: number
  ): number {
    if (matches.length === 0) {
      return 0;
    }

    // 选择匹配词最多的位置
    const best = matches.reduce((prev, curr) =>
      curr.matchCount > prev.matchCount ? curr : prev
    );

    return best.position;
  }

  /**
   * 在指定位置周围提取文本
   */
  private static extractAroundPosition(
    content: string,
    position: number,
    maxLength: number
  ): string {
    const halfLength = Math.floor(maxLength / 2);
    let start = Math.max(0, position - halfLength);
    let end = Math.min(content.length, position + halfLength);

    // 调整到单词边界
    start = this.findWordBoundary(content, start, 'backward');
    end = this.findWordBoundary(content, end, 'forward');

    let excerpt = content.slice(start, end);

    // 添加省略号
    if (start > 0) excerpt = '...' + excerpt;
    if (end < content.length) excerpt = excerpt + '...';

    return excerpt;
  }

  /**
   * 在边界截断
   */
  private static truncateAtBoundary(
    content: string,
    start: number,
    maxLength: number
  ): string {
    if (content.length <= maxLength) {
      return content;
    }

    let end = Math.min(content.length, start + maxLength);
    end = this.findWordBoundary(content, end, 'backward');

    return content.slice(start, end) + '...';
  }

  /**
   * 找到单词边界
   */
  private static findWordBoundary(
    content: string,
    position: number,
    direction: 'forward' | 'backward'
  ): number {
    const boundaries = [' ', '\n', '。', '，', '！', '？', '.', ',', '!', '?'];
    const step = direction === 'forward' ? 1 : -1;
    const limit = direction === 'forward' ? content.length : 0;

    let pos = position;
    while (pos !== limit) {
      if (boundaries.includes(content[pos])) {
        return direction === 'forward' ? pos : pos + 1;
      }
      pos += step;
    }

    return position;
  }

  /**
   * 高亮查询词（可选功能）
   */
  static highlight(excerpt: string, query: string): string {
    const queryTerms = this.tokenize(query.toLowerCase());
    let highlighted = excerpt;

    for (const term of queryTerms) {
      const regex = new RegExp(`(${term})`, 'gi');
      highlighted = highlighted.replace(regex, '**$1**');
    }

    return highlighted;
  }
}





