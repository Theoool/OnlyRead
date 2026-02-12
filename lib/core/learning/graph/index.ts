/**
 * Learning Graph - 学习图谱封装
 * 基于统一的 AI 图谱工作流，为学习场景提供专用接口
 */

import { unifiedGraph } from '@/lib/core/ai/graph/workflow';
import { IGraphState } from '@/lib/core/ai/graph/state';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';

/**
 * 学习图输入参数
 */
interface LearningGraphInput {
  messages?: any[];
  userMessage: string;
  userId: string;
  articleIds?: string[];
  collectionId?: string;
  currentTopic?: string;
  masteryLevel?: number;
}

/**
 * 学习图调用结果
 */
interface LearningGraphOutput {
  finalResponse?: any;
  messages?: any[];
}

/**
 * 将输入转换为图状态
 */
function convertToGraphState(input: LearningGraphInput): Partial<IGraphState> {
  // 将历史消息转换为 LangChain 消息格式
  const messages: any[] = [];
  
  if (input.messages && input.messages.length > 0) {
    for (const msg of input.messages) {
      if (msg.role === 'user') {
        messages.push(new HumanMessage(msg.content));
      } else if (msg.role === 'assistant') {
        messages.push(new AIMessage(msg.content));
      } else if (msg.role === 'system') {
        messages.push(new SystemMessage(msg.content));
      }
    }
  }

  return {
    messages,
    userMessage: input.userMessage,
    userId: input.userId,
    articleIds: input.articleIds || [],
    collectionId: input.collectionId,
    currentTopic: input.currentTopic,
    masteryLevel: input.masteryLevel || 0,
    mode: 'tutor', // 学习场景默认使用 tutor 模式
  };
}

/**
 * Learning Graph - 学习图谱
 * 封装统一图谱，为学习场景提供专用接口
 */
export const learningGraph = {
  /**
   * 调用学习图谱
   */
  async invoke(input: LearningGraphInput): Promise<LearningGraphOutput> {
    try {
      const graphState = convertToGraphState(input);
      
      // 调用统一图谱
      const result = await unifiedGraph.invoke(graphState);
      
      return {
        finalResponse: result.finalResponse,
        messages: result.messages,
      };
    } catch (error) {
      console.error('Learning Graph invoke error:', error);
      throw error;
    }
  },

  /**
   * 流式调用学习图谱
   */
  async *stream(input: LearningGraphInput): AsyncGenerator<any> {
    const graphState = convertToGraphState(input);
    
    for await (const chunk of unifiedGraph.stream(graphState)) {
      yield chunk;
    }
  },
};

export default learningGraph;
