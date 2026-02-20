import { SessionType, SessionStatus, ModeType } from '@/lib/generated/prisma';

export interface Session {
  id: string;
  userId: string;
  title: string | null;
  type: SessionType;
  status: SessionStatus;
  mode: ModeType;
  context: any;
  summary: string | null;
  summaryUpdatedAt: Date | null;
  lastActivityAt: Date;
  createdAt: Date;
  updatedAt: Date;
  messages?: Message[];
  _count?: {
    messages: number;
  };
}

export interface Message {
  id: string;
  sessionId: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string | null;
  ui?: any;
  sources?: any[];
  metadata?: any;
  createdAt: Date;
}

export interface CreateSessionInput {
  type?: SessionType;
  mode?: ModeType;
  title?: string;
  context?: {
    articleIds?: string[];
    collectionId?: string;
    currentTopic?: string;
    masteryLevel?: number;
  };
}

export interface UpdateSessionInput {
  title?: string;
  status?: SessionStatus;
  mode?: ModeType;
  context?: any;
}

export interface SessionFilters {
  type?: SessionType;
  status?: SessionStatus;
}

/**
 * SessionAPI - 会话管理 API 客户端
 */
export const SessionAPI = {
  /**
   * 列出会话
   */
  list: async (filters?: SessionFilters): Promise<Session[]> => {
    const params = new URLSearchParams();
    if (filters?.type) params.set('type', filters.type);
    if (filters?.status) params.set('status', filters.status);

    const res = await fetch(`/api/sessions?${params.toString()}`, {
      credentials: 'include',
    });

    if (!res.ok) {
      throw new Error('Failed to list sessions');
    }

    return res.json();
  },

  /**
   * 获取单个会话
   */
  get: async (sessionId: string): Promise<Session> => {
    const res = await fetch(`/api/sessions/${sessionId}`, {
      credentials: 'include',
    });

    if (!res.ok) {
      throw new Error('Failed to get session');
    }

    return res.json();
  },

  /**
   * 创建会话
   */
  create: async (data: CreateSessionInput): Promise<Session> => {
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      throw new Error('Failed to create session');
    }

    return res.json();
  },

  /**
   * 更新会话
   */
  update: async (sessionId: string, data: UpdateSessionInput): Promise<Session> => {
    const res = await fetch(`/api/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      throw new Error('Failed to update session');
    }

    return res.json();
  },

  /**
   * 删除会话
   */
  delete: async (sessionId: string): Promise<void> => {
    const res = await fetch(`/api/sessions/${sessionId}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!res.ok) {
      throw new Error('Failed to delete session');
    }
  },

  /**
   * 归档会话
   */
  archive: async (sessionId: string): Promise<Session> => {
    return SessionAPI.update(sessionId, { status: 'ARCHIVED' });
  },

  /**
   * 完成会话
   */
  complete: async (sessionId: string): Promise<Session> => {
    return SessionAPI.update(sessionId, { status: 'COMPLETED' });
  },
};

export interface StreamHandlers {
  onMeta?: (data: any) => void;
  onStep?: (data: any) => void;
  onSources?: (data: any) => void;
  onDelta?: (text: string) => void;
  onFinal?: (response: any) => void;  
  onError?: (error: any) => void;
  onDone?: (data: any) => void;
}

/**
 * ChatAPI - 聊天 API 客户端
 */
export const ChatAPI = {
  /**
   * 发送消息（流式响应）
   */
  stream: async (
    sessionId: string,
    message: string,
    handlers: StreamHandlers,
    options?: {
      uiIntent?: string;
      context?: {
        articleIds: string[];
        collectionId?: string;
      };
    }
  ): Promise<void> => {
    const res = await fetch(`/api/sessions/${sessionId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        message,
        uiIntent: options?.uiIntent,
        context: options?.context,
      }),
    });

    if (!res.ok) {
      throw new Error('Failed to send message');
    }

    if (!res.body) {
      throw new Error('No response body');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const feed = (text: string) => {
      buffer += text;
      while (true) {
        const splitIndex = buffer.indexOf('\n\n');
        if (splitIndex === -1) break;

        const frame = buffer.slice(0, splitIndex);
        buffer = buffer.slice(splitIndex + 2);

        const lines = frame.split(/\r?\n/);
        let event = 'message';
        const dataLines: string[] = [];

        for (const line of lines) {
          if (line.startsWith('event:')) {
            event = line.slice('event:'.length).trim();
          } else if (line.startsWith('data:')) {
            const v = line.slice('data:'.length);
            dataLines.push(v.startsWith(' ') ? v.slice(1) : v);
          }
        }

        if (dataLines.length === 0) continue;

        const raw = dataLines.join('\n');
        try {
          const parsed = JSON.parse(raw);
          handleSSEEvent(event, parsed, handlers);
        } catch {
          handleSSEEvent(event, raw, handlers);
        }
      }
    };

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          feed(decoder.decode(value, { stream: true }));
        }
      }
    } finally {
      try {
        reader.releaseLock();
      } catch {}
    }
  },
};

/**
 * 处理 SSE 事件
 */
function handleSSEEvent(event: string, data: any, handlers: StreamHandlers): void {
  switch (event) {
    case 'meta':
      handlers.onMeta?.(data);
      break;
    case 'step':
      handlers.onStep?.(data);
      break;
    case 'sources':
      handlers.onSources?.(data);
      break;
    case 'delta':
      if (typeof data?.text === 'string') {
        handlers.onDelta?.(data.text);
      }
      break;
    case 'final':
      handlers.onFinal?.(data);
      break;
    case 'error':
      handlers.onError?.(data);
      break;
    case 'done':
      handlers.onDone?.(data);
      break;
  }
}

