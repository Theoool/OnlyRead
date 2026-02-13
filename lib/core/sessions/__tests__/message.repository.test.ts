import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { MessageRepository } from '../message.repository';
import { SessionManager } from '../manager';
import { prisma } from '@/lib/infrastructure/database/prisma';

describe('MessageRepository', () => {
  const testUserId = 'test-user-' + Date.now();
  let testSessionId: string;

  beforeEach(async () => {
    // 创建测试会话
    const session = await SessionManager.createSession({
      userId: testUserId,
      type: 'LEARNING',
      mode: 'TUTOR',
    });
    testSessionId = session.id;
  });

  afterEach(async () => {
    // 清理测试数据
    await prisma.learningSession.deleteMany({
      where: { id: testSessionId },
    });
  });

  describe('create', () => {
    it('should create a user message', async () => {
      const message = await MessageRepository.create({
        sessionId: testSessionId,
        role: 'USER',
        content: 'Hello, AI!',
      });

      expect(message.id).toBeDefined();
      expect(message.sessionId).toBe(testSessionId);
      expect(message.role).toBe('USER');
      expect(message.content).toBe('Hello, AI!');
    });

    it('should create an assistant message with UI', async () => {
      const ui = {
        type: 'explanation',
        content: 'This is an explanation',
      };

      const message = await MessageRepository.create({
        sessionId: testSessionId,
        role: 'ASSISTANT',
        content: 'Response',
        ui,
      });

      expect(message.ui).toEqual(ui);
    });

    it('should create message with sources', async () => {
      const sources = [
        { articleId: 'article-1', title: 'Article 1', excerpt: 'Excerpt 1' },
        { articleId: 'article-2', title: 'Article 2', excerpt: 'Excerpt 2' },
      ];

      const message = await MessageRepository.create({
        sessionId: testSessionId,
        role: 'ASSISTANT',
        content: 'Response with sources',
        sources,
      });

      expect(message.sources).toEqual(sources);
    });

    it('should create message with metadata', async () => {
      const metadata = {
        model: 'gpt-4',
        temperature: 0.7,
        tokens: 150,
      };

      const message = await MessageRepository.create({
        sessionId: testSessionId,
        role: 'ASSISTANT',
        content: 'Response',
        metadata,
      });

      expect(message.metadata).toEqual(metadata);
    });
  });

  describe('getBySession', () => {
    it('should get all messages for a session', async () => {
      await MessageRepository.create({
        sessionId: testSessionId,
        role: 'USER',
        content: 'Message 1',
      });

      await MessageRepository.create({
        sessionId: testSessionId,
        role: 'ASSISTANT',
        content: 'Message 2',
      });

      const messages = await MessageRepository.getBySession(testSessionId);

      expect(messages.length).toBe(2);
      expect(messages[0].content).toBe('Message 1');
      expect(messages[1].content).toBe('Message 2');
    });

    it('should limit number of messages', async () => {
      for (let i = 0; i < 5; i++) {
        await MessageRepository.create({
          sessionId: testSessionId,
          role: 'USER',
          content: `Message ${i}`,
        });
      }

      const messages = await MessageRepository.getBySession(testSessionId, 3);

      expect(messages.length).toBe(3);
    });
  });

  describe('getRecentMessages', () => {
    it('should get recent messages in correct order', async () => {
      for (let i = 0; i < 5; i++) {
        await MessageRepository.create({
          sessionId: testSessionId,
          role: 'USER',
          content: `Message ${i}`,
        });
      }

      const messages = await MessageRepository.getRecentMessages(testSessionId, 3);

      expect(messages.length).toBe(3);
      expect(messages[0].content).toBe('Message 2');
      expect(messages[2].content).toBe('Message 4');
    });
  });

  describe('countBySession', () => {
    it('should count messages in session', async () => {
      await MessageRepository.create({
        sessionId: testSessionId,
        role: 'USER',
        content: 'Message 1',
      });

      await MessageRepository.create({
        sessionId: testSessionId,
        role: 'ASSISTANT',
        content: 'Message 2',
      });

      const count = await MessageRepository.countBySession(testSessionId);

      expect(count).toBe(2);
    });
  });

  describe('createMany', () => {
    it('should create multiple messages', async () => {
      const messages = [
        {
          sessionId: testSessionId,
          role: 'USER' as const,
          content: 'Message 1',
        },
        {
          sessionId: testSessionId,
          role: 'ASSISTANT' as const,
          content: 'Message 2',
        },
        {
          sessionId: testSessionId,
          role: 'USER' as const,
          content: 'Message 3',
        },
      ];

      const count = await MessageRepository.createMany(messages);

      expect(count).toBe(3);

      const allMessages = await MessageRepository.getBySession(testSessionId);
      expect(allMessages.length).toBe(3);
    });
  });
});

