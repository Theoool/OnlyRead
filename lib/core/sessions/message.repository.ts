import { prisma } from '@/lib/infrastructure/database/prisma';
import { MessageRole, Prisma } from '@/lib/generated/prisma';

export interface CreateMessageInput {
  sessionId: string;
  role: MessageRole;
  content?: string;
  ui?: any;
  sources?: any[];
  metadata?: any;
}

/**
 * MessageRepository - 消息数据访问层
 */
export class MessageRepository {
  /**
   * 创建消息
   */
  static async create(data: CreateMessageInput): Promise<any> {
    return prisma.learningMessage.create({
      data: {
        sessionId: data.sessionId,
        role: data.role,
        content: data.content,
        ui: data.ui ,
        sources: data.sources,
        metadata: data.metadata || {},
      },
    });
  }

  /**
   * 获取会话的所有消息
   */
  static async getBySession(sessionId: string, limit?: number): Promise<any[]> {
    return prisma.learningMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  /**
   * 获取会话的最近N条消息
   */
  static async getRecentMessages(sessionId: string, count: number = 20): Promise<any[]> {
    const messages = await prisma.learningMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      take: count,
    });
    
    return messages.reverse(); // 返回正序
  }

  /**
   * 获取消息数量
   */
  static async countBySession(sessionId: string): Promise<number> {
    return prisma.learningMessage.count({
      where: { sessionId },
    });
  }

  /**
   * 删除会话的所有消息
   */
  static async deleteBySession(sessionId: string): Promise<number> {
    const result = await prisma.learningMessage.deleteMany({
      where: { sessionId },
    });
    return result.count;
  }

  /**
   * 批量创建消息
   */
  static async createMany(messages: CreateMessageInput[]): Promise<number> {
    const result = await prisma.learningMessage.createMany({
      data: messages.map(m => ({
        sessionId: m.sessionId,
        role: m.role,
        content: m.content,
        ui: m.ui ?? Prisma.JsonNull,
        sources: m.sources ? m.sources : Prisma.JsonNull,
        metadata: m.metadata || {},
      })),
    });
    return result.count;
  }
}

