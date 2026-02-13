# 测试指南

## 概述
本项目包含单元测试、集成测试和端到端测试。

## 测试结构

```
lib/core/sessions/__tests__/
  ├── manager.test.ts           # SessionManager 单元测试
  └── message.repository.test.ts # MessageRepository 单元测试

app/api/sessions/__tests__/
  └── integration.test.ts        # API 集成测试
```

## 运行测试

### 1. 安装依赖
```bash
npm install --save-dev jest @jest/globals @types/jest ts-jest
```

### 2. 配置 Jest

创建 `jest.config.js`:
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};
```

创建 `jest.setup.js`:
```javascript
// 设置测试超时
jest.setTimeout(30000);

// 模拟环境变量
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://...';
process.env.OPENAI_API_KEY = process.env.TEST_OPENAI_API_KEY || 'test-key';
```

### 3. 运行测试

```bash
# 运行所有测试
npm test

# 运行特定测试文件
npm test manager.test.ts

# 运行测试并生成覆盖率报告
npm test -- --coverage

# 监听模式（开发时使用）
npm test -- --watch
```

## 测试数据库

### 使用独立的测试数据库

1. 创建测试数据库：
```sql
CREATE DATABASE anti_ai_reader_test;
```

2. 设置环境变量：
```bash
export TEST_DATABASE_URL="postgresql://user:password@localhost:5432/anti_ai_reader_test"
```

3. 运行迁移：
```bash
DATABASE_URL=$TEST_DATABASE_URL npx prisma migrate deploy
```

## 测试覆盖率目标

- 单元测试：> 80%
- 集成测试：> 70%
- 关键路径：100%

## 编写测试的最佳实践

### 1. 使用描述性的测试名称
```typescript
// ✅ Good
it('should create session with default values', async () => {});

// ❌ Bad
it('test1', async () => {});
```

### 2. 遵循 AAA 模式
```typescript
it('should update session title', async () => {
  // Arrange
  const session = await createTestSession();
  
  // Act
  await SessionManager.updateSession(session.id, userId, {
    title: 'New Title'
  });
  
  // Assert
  const updated = await SessionManager.getSession(session.id, userId);
  expect(updated?.title).toBe('New Title');
});
```

### 3. 清理测试数据
```typescript
afterEach(async () => {
  // 清理测试数据
  await prisma.learningSession.deleteMany({
    where: { userId: testUserId }
  });
});
```

### 4. 使用工厂函数
```typescript
function createTestSession(overrides = {}) {
  return SessionManager.createSession({
    userId: 'test-user',
    type: 'LEARNING',
    mode: 'TUTOR',
    ...overrides
  });
}
```

### 5. 测试边界情况
```typescript
it('should handle empty message list', async () => {
  const messages = await MessageRepository.getBySession('non-existent');
  expect(messages).toEqual([]);
});

it('should handle invalid session ID', async () => {
  await expect(
    SessionManager.getSession('invalid-id', userId)
  ).resolves.toBeNull();
});
```

## 持续集成

### GitHub Actions 配置

创建 `.github/workflows/test.yml`:
```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: anti_ai_reader_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run migrations
        run: npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/anti_ai_reader_test
          
      - name: Run tests
        run: npm test -- --coverage
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/anti_ai_reader_test
          
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

## 性能测试

### 使用 k6 进行负载测试

创建 `tests/load/chat.js`:
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 0 },
  ],
};

export default function () {
  const sessionId = 'test-session-id';
  const payload = JSON.stringify({
    message: 'Hello, AI!',
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token',
    },
  };

  const res = http.post(
    `http://localhost:3000/api/sessions/${sessionId}/chat`,
    payload,
    params
  );

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 2s': (r) => r.timings.duration < 2000,
  });

  sleep(1);
}
```

运行负载测试：
```bash
k6 run tests/load/chat.js
```

## 故障排查

### 测试失败常见原因

1. **数据库连接失败**
   - 检查 `TEST_DATABASE_URL` 环境变量
   - 确保测试数据库已创建并运行迁移

2. **测试数据未清理**
   - 确保 `afterEach` 钩子正确执行
   - 使用唯一的测试用户 ID

3. **异步问题**
   - 确保所有异步操作都使用 `await`
   - 增加测试超时时间

4. **环境变量缺失**
   - 检查 `.env.test` 文件
   - 确保所有必需的环境变量都已设置

## 测试报告

测试完成后，查看报告：

```bash
# 查看覆盖率报告
open coverage/lcov-report/index.html

# 查看测试结果
cat test-results.json
```

