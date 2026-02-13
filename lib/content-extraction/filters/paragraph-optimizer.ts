/**
 * 段落优化器 - 智能合并和优化段落结构
 * 优化：独立模块，提升可读性
 */

export class ParagraphOptimizer {
  /**
   * 优化文档中的段落结构
   */
  optimize(document: Document): Document {
    const paragraphs = Array.from(document.querySelectorAll('p'));

    for (let i = 0; i < paragraphs.length - 1; i++) {
      const current = paragraphs[i];
      const next = paragraphs[i + 1];

      if (!current.parentElement || !next.parentElement) continue;

      const currentText = current.textContent?.trim() || '';
      const nextText = next.textContent?.trim() || '';

      if (this.shouldMerge(currentText, nextText)) {
        current.textContent = currentText + ' ' + nextText;
        next.remove();
        i--; // 重新检查当前段落
      }
    }

    return document;
  }

  /**
   * 判断两个段落是否应该合并
   */
  private shouldMerge(current: string, next: string): boolean {
    // 当前段落有开放式结尾
    const hasOpenEnding = /[，：；,\-:;]$/.test(current) ||
      !/[.!?。！？]$/.test(current);

    // 下一段落以小写开头
    const nextStartsLower = /^[a-z\u4e00-\u9fa5]/.test(next);

    // 两段都较短
    const isShort = current.length < 50 && next.length < 50;

    // 引号连续
    const currentEndsWithQuote = /["']$/.test(current);
    const nextStartsWithQuote = /^["']/.test(next);

    return (hasOpenEnding && nextStartsLower && isShort) ||
      (currentEndsWithQuote && nextStartsWithQuote);
  }

  /**
   * 分析段落质量
   */
  analyzeParagraphQuality(text: string): {
    score: number;
    issues: string[];
  } {
    const issues: string[] = [];
    let score = 100;

    // 检查长度
    if (text.length < 20) {
      issues.push('段落过短');
      score -= 20;
    } else if (text.length > 500) {
      issues.push('段落过长');
      score -= 10;
    }

    // 检查标点
    const punctuationCount = (text.match(/[.!?。！？]/g) || []).length;
    if (punctuationCount === 0 && text.length > 50) {
      issues.push('缺少标点');
      score -= 15;
    }

    // 检查空格
    const hasProperSpacing = /\s/.test(text);
    if (!hasProperSpacing && text.length > 30) {
      issues.push('缺少空格');
      score -= 10;
    }

    return { score: Math.max(0, score), issues };
  }
}

// 导出单例
export const paragraphOptimizer = new ParagraphOptimizer();

