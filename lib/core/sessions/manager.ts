import { prisma } from '@/lib/infrastructure/database/prisma';
import { SessionType, SessionStatus, ModeType } from '@/lib/generated/prisma';
import { randomUUID } from 'crypto';

export interface CreateSessionInput {
  id?: string;
  userId: string;
  type: SessionType;
  mode: ModeType;
  context?: any;
  title?: string;
}

export interface UpdateSessionInput {
  title?: string;
  status?: SessionStatus;
  context?: any;
  mode?: ModeType;
}

export interface SessionFilters {
  type?: SessionType;
  status?: SessionStatus;
}

/**
 * SessionManager - 统一会话管理
 * 负责会话的创建、查询、更新、归档和删除
 */
export class SessionManager {
  /**
   * 获取或创建会话（幂等操作）
   * 如果会话不存在，自动创建一个新会话
   */
  static async getOrCreateSession(sessionId: string, userId: string): Promise<any> {
    let session = await prisma.learningSession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      session = await this.createSession({
        id: sessionId,
        userId,
        type: 'COPILOT',
        mode: 'TUTOR',
      });
    }

    return session;
  }

  /**
   * 创建新会话
   */
  static async createSession(data: CreateSessionInput): Promise<any> {
    const title = data.title || this.generateTitle(data.type, data.context);

    return prisma.learningSession.create({
      data: {
        id: data.id || randomUUID(),
        userId: data.userId,
        type: data.type,
        mode: data.mode,
        status: 'ACTIVE',
        title,
        context: data.context || {},
        lastActivityAt: new Date(),
      },
    });
  }

  /**
   * 获取单个会话（包含消息）
   */
  static async getSession(sessionId: string, userId: string): Promise<any> {
    return prisma.learningSession.findFirst({
      where: { id: sessionId, userId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: { messages: true },
        },
      },
    });
  }

  /**
   * 列出用户的所有会话
   */
  static async listSessions(userId: string, filters?: SessionFilters): Promise<any[]> {
    return prisma.learningSession.findMany({
      where: {
        userId,
        type: filters?.type,
        status: filters?.status || 'ACTIVE',
      },
      orderBy: { lastActivityAt: 'desc' },
      include: {
        _count: {
          select: { messages: true },
        },
      },
    });
  }

  /**
   * 更新会话
   */
  static async updateSession(
    sessionId: string,
    userId: string,
    updates: UpdateSessionInput
  ): Promise<any> {
    return prisma.learningSession.updateMany({
      where: { id: sessionId, userId },
      data: {
        ...updates,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * 更新会话活动时间
   */
  static async updateActivity(sessionId: string): Promise<void> {
    await prisma.learningSession.update({
      where: { id: sessionId },
      data: { 
        lastActivityAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  /**
   * 归档会话
   */
  static async archiveSession(sessionId: string, userId: string): Promise<void> {
    await prisma.learningSession.updateMany({
      where: { id: sessionId, userId },
      data: { 
        status: 'ARCHIVED',
        updatedAt: new Date(),
      },
    });
  }

  /**
   * 完成会话
   */
  static async completeSession(sessionId: string, userId: string): Promise<void> {
    await prisma.learningSession.updateMany({
      where: { id: sessionId, userId },
      data: { 
        status: 'COMPLETED',
        updatedAt: new Date(),
      },
    });
  }

  /**
   * 删除会话
   */
  static async deleteSession(sessionId: string, userId: string): Promise<{ deletedCount: number }> {
    const result = await prisma.learningSession.deleteMany({
      where: { id: sessionId, userId },
    });
    return { deletedCount: result.count };
  }

  /**
   * 批量归档旧会话
   * @param userId 用户ID
   * @param daysInactive 不活跃天数阈值
   */
  static async archiveInactiveSessions(userId: string, daysInactive: number = 30): Promise<number> {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - daysInactive);

    const result = await prisma.learningSession.updateMany({
      where: {
        userId,
        status: 'ACTIVE',
        lastActivityAt: {
          lt: threshold,
        },
      },
      data: {
        status: 'ARCHIVED',
        updatedAt: new Date(),
      },
    });

    return result.count;
  }

  /**
   * 获取会话统计
   */
  static async getSessionStats(userId: string): Promise<{
    total: number;
    active: number;
    archived: number;
    completed: number;
    byType: Record<string, number>;
  }> {
    const sessions = await prisma.learningSession.findMany({
      where: { userId },
      select: { status: true, type: true },
    });

    const stats = {
      total: sessions.length,
      active: sessions.filter(s => s.status === 'ACTIVE').length,
      archived: sessions.filter(s => s.status === 'ARCHIVED').length,
      completed: sessions.filter(s => s.status === 'COMPLETED').length,
      byType: {} as Record<string, number>,
    };

    sessions.forEach(s => {
      stats.byType[s.type] = (stats.byType[s.type] || 0) + 1;
    });

    return stats;
  }

  /**
   * 生成会话标题
   */
  private static generateTitle(type: SessionType, context?: any): string {
    if (type === 'LEARNING' && context?.currentTopic) {
      return `学习：${context.currentTopic}`;
    }
    if (type === 'QA') {
      return '快速问答';
    }
    if (type === 'COPILOT') {
      return 'AI 助手';
    }
    return '新对话';
  }
}

