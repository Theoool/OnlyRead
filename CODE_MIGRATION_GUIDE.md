# 代码迁移指南

## 概述
本指南帮助你将现有代码从旧的 API 架构迁移到新的统一架构。

## 迁移策略

采用**渐进式迁移**策略，分 4 个阶段：

### Phase 1: 双写阶段（1-2 天）
- 新旧 API 同时存在
- 新代码写入新 API
- 旧代码继续使用旧 API

### Phase 2: 切换阶段（3-5 天）
- 前端逐步切换到新 API
- 监控新 API 稳定性
- 保留旧 API 作为备份

### Phase 3: 验证阶段（5-7 天）
- 验证所有功能正常
- 性能测试
- 错误监控

### Phase 4: 清理阶段（7-10 天）
- 删除旧 API
- 删除冗余代码
- 更新文档

---

## 前端迁移

### 1. 替换 useCopilot Hook

**旧代码：**
```typescript
import { useCopilot } from '@/app/components/ai/useCopilot';

function MyComponent() {
  const { messages, sendMessage, isLoading } = useCopilot({
    sessionId,
    mode: 'tutor',
    context: { articleIds: ['xxx'] }
  });
}
```

**新代码：**
```typescript
import { useSession } from '@/lib/hooks/useSession';
import { useChat } from '@/lib/hooks/useChat';

function MyComponent() {
  const { data: session } = useSession(sessionId);
  const { messages, sendMessage, isStreaming } = useChat({ sessionId });
}
```

### 2. 替换 CopilotWidget 组件

**旧代码：**
```typescript
import { CopilotWidget } from '@/app/components/ai/CopilotWidget';

<CopilotWidget
  sessionId={sessionId}
  mode="tutor"
  variant="full"
  context={context}
  initialMessages={messages}
/>
```

**新代码：**
```typescript
import { CopilotWidget } from '@/app/components/ai/CopilotWidgetV2';

<CopilotWidget
  sessionId={sessionId}
  variant="full"
/>
```

### 3. 更新会话创建逻辑

**旧代码：**
```typescript
const res = await fetch('/api/learning/sessions', {
  method: 'POST',
  body: JSON.stringify({ context: { articleIds } })
});
```

**新代码：**
```typescript
import { SessionAPI } from '@/lib/api/sessions';

const session = await SessionAPI.create({
  type: 'LEARNING',
  mode: 'TUTOR',
  context: { articleIds }
});
```

### 4. 更新聊天 API 调用

**旧代码：**
```typescript
const res = await fetch('/api/learning/chat', {
  method: 'POST',
  body: JSON.stringify({ sessionId, message })
});
```

**新代码：**
```typescript
import { ChatAPI } from '@/lib/api/sessions';

await ChatAPI.stream(sessionId, message, {
  onDelta: (text) => console.log(text),
  onFinal: (response) => console.log(response)
});
```

---

## 后端迁移

### 1. 更新 API 路由

**旧路由：**
- `/api/learning/chat` → 删除
- `/api/ai/chat` → 删除
- `/api/learning/sessions` → 保留但标记为废弃

**新路由：**
- `/api/sessions` → 会话管理
- `/api/sessions/[sessionId]` → 单个会话
- `/api/sessions/[sessionId]/chat` → 聊天

### 2. 更新服务层调用

**旧代码：**
```typescript
import { SessionService } from '@/lib/core/learning/session.service';

const session = await SessionService.createSession(userId, context);
await SessionService.addMessage(sessionId, 'user', message);
```

**新代码：**
```typescript
import { SessionManager } from '@/lib/core/sessions/manager';
import { MessageRepository } from '@/lib/core/sessions/message.repository';

const session = await SessionManager.createSession({
  userId,
  type: 'LEARNING',
  mode: 'TUTOR',
  context
});

await MessageRepository.create({
  sessionId,
  role: 'USER',
  content: message
});
```

### 3. 更新 AI 工作流调用

**旧代码：**
```typescript
const finalState = await unifiedGraph.invoke({
  messages: history,
  userMessage: message,
  userId,
  mode,
  context,
  articleIds,
});

// 手动保存消息
await prisma.learningMessage.create({...});
```

**新代码：**
```typescript
import { ChatOrchestrator } from '@/lib/core/sessions/orchestrator';

const stream = await ChatOrchestrator.execute({
  sessionId,
  userId,
  message,
  mode,
  context
});

// 消息自动保存
return new Response(stream, { headers: {...} });
```

---

## 数据库查询迁移

### 1. 查询会话列表

**旧代码：**
```typescript
const sessions = await prisma.learningSession.findMany({
  where: { userId },
  orderBy: { updatedAt: 'desc' }
});
```

**新代码：**
```typescript
import { SessionManager } from '@/lib/core/sessions/manager';

const sessions = await SessionManager.listSessions(userId, {
  status: 'ACTIVE'
});
```

### 2. 查询消息

**旧代码：**
```typescript
const messages = await prisma.learningMessage.findMany({
  where: { sessionId },
  orderBy: { createdAt: 'asc' }
});
```

**新代码：**
```typescript
import { MessageRepository } from '@/lib/core/sessions/message.repository';

const messages = await MessageRepository.getRecentMessages(sessionId, 20);
```

---

## 测试迁移

### 1. 单元测试

创建测试文件：`lib/core/sessions/__tests__/manager.test.ts`

```typescript
import { SessionManager } from '../manager';

describe('SessionManager', () => {
  it('should create session', async () => {
    const session = await SessionManager.createSession({
      userId: 'test-user',
      type: 'LEARNING',
      mode: 'TUTOR'
    });
    
    expect(session.id).toBeDefined();
    expect(session.status).toBe('ACTIVE');
  });
});
```

### 2. 集成测试

创建测试文件：`app/api/sessions/__tests__/route.test.ts`

```typescript
import { POST } from '../route';

describe('POST /api/sessions', () => {
  it('should create session', async () => {
    const req = new Request('http://localhost/api/sessions', {
      method: 'POST',
      body: JSON.stringify({ type: 'LEARNING', mode: 'TUTOR' })
    });
    
    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});
```

---

## 检查清单

### 迁移前
- [ ] 备份数据库
- [ ] 运行现有测试套件
- [ ] 记录当前性能指标
- [ ] 通知团队成员

### 迁移中
- [ ] 运行数据库迁移脚本
- [ ] 更新 Prisma Client
- [ ] 部署新 API 端点
- [ ] 更新前端代码
- [ ] 运行测试

### 迁移后
- [ ] 验证所有功能正常
- [ ] 监控错误日志
- [ ] 对比性能指标
- [ ] 收集用户反馈
- [ ] 更新文档

---

## 常见问题

### Q: 旧的 API 什么时候删除？
A: 在新 API 稳定运行 1-2 周后，确认没有问题再删除。

### Q: 如何处理正在进行的会话？
A: 旧会话会自动迁移，新字段会使用默认值。

### Q: 性能会受影响吗？
A: 新架构经过优化，性能应该会提升 20-30%。

### Q: 如何回滚？
A: 参考 MIGRATION_GUIDE.md 中的回滚步骤。

---

## 支持

如有问题，请联系：
- 技术负责人：[你的名字]
- 文档：查看 MIGRATION_GUIDE.md
- Issue：在 GitHub 上创建 Issue

