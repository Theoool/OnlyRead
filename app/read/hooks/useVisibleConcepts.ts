import { useMemo } from "react";
import { ConceptData } from "@/lib/store/useConceptStore";

interface UseVisibleConceptsOptions {
  content?: string;
  concepts: Record<string, ConceptData>;
  maxVisible?: number;
}

/**
 * 优化的概念卡片可见性计算
 * 使用预处理和索引来提高性能
 */
export function useVisibleConcepts({
  content,
  concepts,
  maxVisible = 5
}: UseVisibleConceptsOptions) {
  return useMemo(() => {
    if (!content) return [];

    // 预处理：转换为小写并缓存
    const contentLower = content.toLowerCase();
    
    // 提前获取所有概念数组，避免重复调用 Object.values
    const allConcepts = Object.values(concepts);
    
    // 如果没有概念，直接返回
    if (allConcepts.length === 0) return [];

    // 使用 reduce 一次遍历完成过滤和限制
    const visible: ConceptData[] = [];
    
    for (const concept of allConcepts) {
      // 提前检查是否已达到最大数量
      if (visible.length >= maxVisible) break;
      
      // 验证 term 存在且非空
      if (!concept.term || concept.term.trim().length === 0) continue;
      
      // 检查内容中是否包含该术语
      if (contentLower.includes(concept.term.toLowerCase())) {
        visible.push(concept);
      }
    }
    
    return visible;
  }, [content, concepts, maxVisible]);
}

/**
 * 高级版本：支持词频统计和排序
 * 适用于需要按重要性排序的场景
 */
export function useVisibleConceptsWithFrequency({
  content,
  concepts,
  maxVisible = 5
}: UseVisibleConceptsOptions) {
  return useMemo(() => {
    if (!content) return [];

    const contentLower = content.toLowerCase();
    const allConcepts = Object.values(concepts);
    
    if (allConcepts.length === 0) return [];

    // 计算每个概念的出现频率
    const conceptsWithFrequency = allConcepts
      .filter(c => c.term && c.term.trim().length > 0)
      .map(concept => {
        const termLower = concept.term.toLowerCase();
        // 计算出现次数
        const matches = contentLower.split(termLower).length - 1;
        return { concept, frequency: matches };
      })
      .filter(item => item.frequency > 0)
      // 按频率降序排序
      .sort((a, b) => b.frequency - a.frequency)
      // 限制数量
      .slice(0, maxVisible)
      .map(item => item.concept);

    return conceptsWithFrequency;
  }, [content, concepts, maxVisible]);
}

