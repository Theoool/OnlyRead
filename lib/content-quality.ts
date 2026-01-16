/**
 * Content Quality Analyzer - 内容质量检测器
 * 分析提取的内容质量，提供改进建议
 */

export interface QualityReport {
  score: number; // 0-100
  level: 'excellent' | 'good' | 'fair' | 'poor';
  issues: string[];
  suggestions: string[];
  canImprove: boolean;
  needsRetry: boolean;
  stats: {
    wordCount: number;
    paragraphCount: number;
    headingCount: number;
    codeBlockCount: number;
    imageCount: number;
    listCount: number;
  };
}

/**
 * 分析内容质量
 */
export function analyzeQuality(content: string): QualityReport {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 100;
  let needsRetry = false;

  // 统计
  const stats = calculateStats(content);

  // 检测1: 内容长度
  if (stats.wordCount < 100) {
    issues.push('内容过短（少于100字），可能提取不完整');
    score -= 40;
    needsRetry = true;
  } else if (stats.wordCount < 300) {
    issues.push('内容较短，可能不完整');
    score -= 20;
  } else if (stats.wordCount < 500) {
    suggestions.push('内容长度适中');
  } else {
    // 内容较长，加分
    score = Math.min(100, score + 5);
  }

  // 检测2: 段落数量
  if (stats.paragraphCount < 2) {
    issues.push('段落数量过少，可能格式错误');
    score -= 15;
  } else if (stats.paragraphCount < 5) {
    suggestions.push('段落数量较少，可能影响阅读体验');
    score -= 5;
  }

  // 检测3: 标题层级结构
  if (stats.headingCount === 0 && stats.wordCount > 500) {
    suggestions.push('文章缺少标题层级，添加标题可以提升可读性');
    score -= 10;
  } else if (stats.headingCount >= 3) {
    score += 5;
  }

  // 检测4: 推广内容噪音（中文）
  const noiseKeywordsCN = [
    '推荐阅读',
    '关注公众号',
    '扫码关注',
    '点击原文',
    '分享到',
    '本文首发于',
    '转载请注明',
    '商业转载',
    '更多精彩',
    '相关文章',
    '欢迎关注',
    '长按识别',
    '阅读原文',
    '点击此处',
  ];

  const foundNoiseCN = noiseKeywordsCN.filter(kw => content.includes(kw));
  if (foundNoiseCN.length > 0) {
    issues.push(`包含推广内容: ${foundNoiseCN.slice(0, 3).join(', ')}`);
    score -= foundNoiseCN.length * 5;
  }

  // 检测5: 推广内容噪音（英文）
  const noiseKeywordsEN = [
    'Recommended for you',
    'Related articles',
    'Share this',
    'Follow us',
    'Subscribe to',
    'Read more',
    'Sponsored',
    'Advertisement',
  ];

  const foundNoiseEN = noiseKeywordsEN.filter(kw =>
    new RegExp(kw, 'i').test(content)
  );
  if (foundNoiseEN.length > 0) {
    issues.push(`包含推广内容: ${foundNoiseEN.slice(0, 3).join(', ')}`);
    score -= foundNoiseEN.length * 5;
  }

  // 检测6: 乱码字符
  const hasGarbled = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFD]/.test(content);
  if (hasGarbled) {
    issues.push('包含乱码或特殊字符');
    score -= 10;
    needsRetry = true;
  }

  // 检测7: HTML残留
  const hasHtmlTags = /<[^>]+>/.test(content);
  if (hasHtmlTags) {
    issues.push('包含未转换的HTML标签');
    score -= 15;
    needsRetry = true;
  }

  // 检测8: 空行过多
  const emptyLines = (content.match(/\n\n\n/g) || []).length;
  if (emptyLines > 10) {
    suggestions.push('空行过多，已自动优化');
    score -= 5;
  }

  // 检测9: 列表和代码块（技术内容指标）
  if (stats.codeBlockCount > 0) {
    score += 3;
  }
  if (stats.listCount > 0) {
    score += 2;
  }

  // 检测10: 图片质量
  if (stats.imageCount === 0 && stats.wordCount > 1000) {
    suggestions.push('长文章可以添加图片提升阅读体验');
  } else if (stats.imageCount > 10) {
    suggestions.push('图片数量较多，注意检查是否包含广告图片');
  }

  // 检测11: 重复内容
  const lines = content.split('\n');
  const uniqueLines = new Set(lines);
  const duplicateRatio = 1 - (uniqueLines.size / lines.length);
  if (duplicateRatio > 0.3) {
    issues.push('内容重复率过高，可能提取异常');
    score -= 20;
    needsRetry = true;
  }

  // 限制分数范围
  score = Math.max(0, Math.min(100, score));

  // 确定质量等级
  let level: QualityReport['level'];
  if (score >= 85) level = 'excellent';
  else if (score >= 70) level = 'good';
  else if (score >= 50) level = 'fair';
  else level = 'poor';

  return {
    score,
    level,
    issues,
    suggestions,
    canImprove: foundNoiseCN.length > 0 || foundNoiseEN.length > 0 || needsRetry,
    needsRetry,
    stats,
  };
}

/**
 * 计算内容统计信息
 */
function calculateStats(content: string): QualityReport['stats'] {
  // 字数统计（中文按字符，英文按单词）
  const chineseChars = (content.match(/[\u4e00-\u9fa5]/g) || []).length;
  const englishWords = (content.match(/[a-zA-Z]+/g) || []).length;
  const wordCount = chineseChars + englishWords;

  // 段落数量
  const paragraphs = content.split('\n\n').filter(p => p.trim().length > 0);
  const paragraphCount = paragraphs.length;

  // 标题数量
  const headingCount = (content.match(/^#{1,6}\s/gm) || []).length;

  // 代码块数量
  const codeBlockCount = (content.match(/```/g) || []).length / 2;

  // 图片数量
  const imageCount = (content.match(/!\[([^\]]*)\]\(([^)]+)\)/g) || []).length;

  // 列表数量
  const listCount = (content.match(/^\s*[-*+]\s/gm) || []).length +
                   (content.match(/^\s*\d+\.\s/gm) || []).length;

  return {
    wordCount,
    paragraphCount,
    headingCount,
    codeBlockCount,
    imageCount,
    listCount,
  };
}

/**
 * 格式化质量报告为用户友好的文本
 */
export function formatQualityReport(report: QualityReport): string {
  const lines: string[] = [];

  // 质量等级
  const levelText = {
    excellent: '优秀 ✓',
    good: '良好 ✓',
    fair: '一般 ~',
    poor: '较差 ✗',
  };

  lines.push(`内容质量：${report.score}分 (${levelText[report.level]})`);
  lines.push('');

  // 统计信息
  lines.push('📊 内容统计：');
  lines.push(`  • 字数：${report.stats.wordCount}`);
  lines.push(`  • 段落：${report.stats.paragraphCount}`);
  lines.push(`  • 标题：${report.stats.headingCount}`);
  if (report.stats.codeBlockCount > 0) {
    lines.push(`  • 代码块：${report.stats.codeBlockCount}`);
  }
  if (report.stats.imageCount > 0) {
    lines.push(`  • 图片：${report.stats.imageCount}`);
  }
  lines.push('');

  // 问题
  if (report.issues.length > 0) {
    lines.push('⚠️ 检测到的问题：');
    report.issues.forEach(issue => {
      lines.push(`  • ${issue}`);
    });
    lines.push('');
  }

  // 建议
  if (report.suggestions.length > 0) {
    lines.push('💡 改进建议：');
    report.suggestions.forEach(suggestion => {
      lines.push(`  • ${suggestion}`);
    });
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * 根据质量报告决定是否需要AI增强
 */
export function shouldUseAIEnhancement(report: QualityReport): boolean {
  // 以下情况建议使用AI增强
  return (
    report.score < 70 || // 分数低于70
    report.issues.length > 2 || // 超过2个问题
    report.canImprove // 明确可以改进
  );
}
