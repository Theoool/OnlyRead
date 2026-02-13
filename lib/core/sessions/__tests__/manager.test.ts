import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { SessionManager } from '../manager';
import { prisma } from '@/lib/infrastructure/database/prisma';

describe('SessionManager', () => {
  const testUserId = 'test-user-' + Date.now();
  const createdSessionIds: string[] = [];

  afterEach(async () => {
    // 清理测试数据
    for (const sessionId of createdSessionIds) {
      await prisma.learningSession.deleteMany({
        where: { id: sessionId },
      });
    }
    createdSessionIds.length = 0;
  });

  describe('createSession', () => {
    it('should create a new session with default values', async () => {
      const session = await SessionManager.createSession({
        userId: testUserId,
        type: 'LEARNING',
        mode: 'TUTOR',
      });

      createdSessionIds.push(session.id);

      expect(session.id).toBeDefined();
      expect(session.userId).toBe(testUserId);
      expect(session.type).toBe('LEARNING');
      expect(session.mode).toBe('TUTOR');
      expect(session.status).toBe('ACTIVE');
      expect(session.lastActivityAt).toBeDefined();
    });

    it('should create session with custom title', async () => {
      const customTitle = 'My Custom Session';
      const session = await SessionManager.createSession({
        userId: testUserId,
        type: 'COPILOT',
        mode: 'COPILOT',
        title: customTitle,
      });

      createdSessionIds.push(session.id);

      expect(session.title).toBe(customTitle);
    });

    it('should create session with context', async () => {
      const context = {
        articleIds: ['article-1', 'article-2'],
        currentTopic: 'Test Topic',
      };

      const session = await SessionManager.createSession({
        userId: testUserId,
        type: 'LEARNING',
        mode: 'TUTOR',
        context,
      });

      createdSessionIds.push(session.id);

      expect(session.context).toEqual(context);
    });
  });

  describe('getOrCreateSession', () => {
    it('should create session if not exists', async () => {
      const sessionId = 'new-session-' + Date.now();
      const session = await SessionManager.getOrCreateSession(sessionId, testUserId);

      createdSessionIds.push(session.id);

      expect(session.id).toBe(sessionId);
      expect(session.userId).toBe(testUserId);
    });

    it('should return existing session', async () => {
      const session1 = await SessionManager.createSession({
        userId: testUserId,
        type: 'LEARNING',
        mode: 'TUTOR',
      });

      createdSessionIds.push(session1.id);

      const session2 = await SessionManager.getOrCreateSession(session1.id, testUserId);

      expect(session2.id).toBe(session1.id);
    });
  });

  describe('listSessions', () => {
    it('should list user sessions', async () => {
      const session1 = await SessionManager.createSession({
        userId: testUserId,
        type: 'LEARNING',
        mode: 'TUTOR',
      });

      const session2 = await SessionManager.createSession({
        userId: testUserId,
        type: 'COPILOT',
        mode: 'COPILOT',
      });

      createdSessionIds.push(session1.id, session2.id);

      const sessions = await SessionManager.listSessions(testUserId);

      expect(sessions.length).toBeGreaterThanOrEqual(2);
      expect(sessions.some(s => s.id === session1.id)).toBe(true);
      expect(sessions.some(s => s.id === session2.id)).toBe(true);
    });

    it('should filter by type', async () => {
      const session1 = await SessionManager.createSession({
        userId: testUserId,
        type: 'LEARNING',
        mode: 'TUTOR',
      });

      const session2 = await SessionManager.createSession({
        userId: testUserId,
        type: 'COPILOT',
        mode: 'COPILOT',
      });

      createdSessionIds.push(session1.id, session2.id);

      const sessions = await SessionManager.listSessions(testUserId, {
        type: 'LEARNING',
      });

      expect(sessions.every(s => s.type === 'LEARNING')).toBe(true);
    });

    it('should filter by status', async () => {
      const session = await SessionManager.createSession({
        userId: testUserId,
        type: 'LEARNING',
        mode: 'TUTOR',
      });

      createdSessionIds.push(session.id);

      await SessionManager.archiveSession(session.id, testUserId);

      const activeSessions = await SessionManager.listSessions(testUserId, {
        status: 'ACTIVE',
      });

      expect(activeSessions.every(s => s.status === 'ACTIVE')).toBe(true);
      expect(activeSessions.some(s => s.id === session.id)).toBe(false);
    });
  });

  describe('updateSession', () => {
    it('should update session title', async () => {
      const session = await SessionManager.createSession({
        userId: testUserId,
        type: 'LEARNING',
        mode: 'TUTOR',
      });

      createdSessionIds.push(session.id);

      const newTitle = 'Updated Title';
      await SessionManager.updateSession(session.id, testUserId, {
        title: newTitle,
      });

      const updated = await SessionManager.getSession(session.id, testUserId);
      expect(updated?.title).toBe(newTitle);
    });

    it('should update session status', async () => {
      const session = await SessionManager.createSession({
        userId: testUserId,
        type: 'LEARNING',
        mode: 'TUTOR',
      });

      createdSessionIds.push(session.id);

      await SessionManager.updateSession(session.id, testUserId, {
        status: 'COMPLETED',
      });

      const updated = await SessionManager.getSession(session.id, testUserId);
      expect(updated?.status).toBe('COMPLETED');
    });
  });

  describe('archiveSession', () => {
    it('should archive session', async () => {
      const session = await SessionManager.createSession({
        userId: testUserId,
        type: 'LEARNING',
        mode: 'TUTOR',
      });

      createdSessionIds.push(session.id);

      await SessionManager.archiveSession(session.id, testUserId);

      const archived = await SessionManager.getSession(session.id, testUserId);
      expect(archived?.status).toBe('ARCHIVED');
    });
  });

  describe('deleteSession', () => {
    it('should delete session', async () => {
      const session = await SessionManager.createSession({
        userId: testUserId,
        type: 'LEARNING',
        mode: 'TUTOR',
      });

      const result = await SessionManager.deleteSession(session.id, testUserId);

      expect(result.deletedCount).toBe(1);

      const deleted = await SessionManager.getSession(session.id, testUserId);
      expect(deleted).toBeNull();
    });
  });

  describe('getSessionStats', () => {
    it('should return session statistics', async () => {
      const session1 = await SessionManager.createSession({
        userId: testUserId,
        type: 'LEARNING',
        mode: 'TUTOR',
      });

      const session2 = await SessionManager.createSession({
        userId: testUserId,
        type: 'COPILOT',
        mode: 'COPILOT',
      });

      createdSessionIds.push(session1.id, session2.id);

      await SessionManager.archiveSession(session2.id, testUserId);

      const stats = await SessionManager.getSessionStats(testUserId);

      expect(stats.total).toBeGreaterThanOrEqual(2);
      expect(stats.active).toBeGreaterThanOrEqual(1);
      expect(stats.archived).toBeGreaterThanOrEqual(1);
      expect(stats.byType.LEARNING).toBeGreaterThanOrEqual(1);
      expect(stats.byType.COPILOT).toBeGreaterThanOrEqual(1);
    });
  });
});

