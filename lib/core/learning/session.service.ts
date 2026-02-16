import { prisma } from '@/lib/infrastructure/database/prisma';
import { Prisma } from '@/lib/generated/prisma';

export class SessionService {
  
  static async listSessions(userId: string) {
    return prisma.learningSession.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: { messages: true }
        }
      }
    });
  }

  static async getSession(sessionId: string, userId: string) {
    return prisma.learningSession.findFirst({
      where: { id: sessionId, userId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });
  }

  static async createSession(userId: string, context: any) {
    // Generate a title based on context or default
    let title = "New Learning Session";
    if (context?.currentTopic) {
      title = `Learning: ${context.currentTopic}`;
    }

    return prisma.learningSession.create({
      data: {
        userId,
        context: context || {},
        title
      }
    });
  }

  static async addMessage(sessionId: string, role: 'user' | 'assistant', content: string, metadata?: { ui?: any, sources?: any }) {
    // Convert role to Prisma enum format
    const prismaRole = role === 'user' ? 'USER' : 'ASSISTANT';
    return prisma.learningMessage.create({
      data: {
        sessionId,
        role: prismaRole,
        content,
        ui: metadata?.ui ?? Prisma.JsonNull,
        sources: metadata?.sources ?? Prisma.JsonNull
      }
    });
  }

  static async deleteSession(sessionId: string, userId: string) {
    const result = await prisma.learningSession.deleteMany({
      where: { id: sessionId, userId },
    })
    return { deletedCount: result.count }
  }
  
  static async updateSessionContext(sessionId: string, context: any) {
      return prisma.learningSession.update({
          where: { id: sessionId },
          data: { context }
      });
  }
}
