# 代码清理清单

## 概述
在新架构稳定运行后，可以安全删除以下旧代码和冗余文件。

## ⚠️ 重要提示
- 在删除任何代码前，确保新架构已经稳定运行至少 1-2 周
- 建议先注释掉代码，观察一段时间后再删除
- 保留 Git 历史记录，以便需要时可以恢复

---

## 📁 可以删除的文件

### 1. 旧的 API 端点
```
❌ app/api/(core)/ai/chat/route.ts
❌ app/api/(core)/learning/chat/route.ts
❌ app/api/learning/sessions/[id]/route.ts (部分功能已迁移)
```

**替代方案：**
- ✅ `app/api/sessions/route.ts`
- ✅ `app/api/sessions/[sessionId]/route.ts`
- ✅ `app/api/sessions/[sessionId]/chat/route.ts`

### 2. 旧的 Hook
```
❌ app/components/ai/useCopilot.ts (724 行，已被拆分)
```

**替代方案：**
- ✅ `lib/hooks/useSession.ts`
- ✅ `lib/hooks/useChat.ts`

### 3. 旧的组件
```
❌ app/components/ai/CopilotWidget.tsx (旧版本，724 行)
```

**替代方案：**
- ✅ `app/components/ai/CopilotWidgetV2.tsx` (简化版)
- ✅ `app/components/ai/ChatHeader.tsx`
- ✅ `app/components/ai/ChatMessages.tsx`
- ✅ `app/components/ai/ChatInput.tsx`

### 4. 冗余的服务层
```
⚠️ lib/core/learning/session.service.ts (部分功能重复)
```

**说明：**
- 保留用于向后兼容
- 可以逐步迁移到 `SessionManager`
- 最终可以删除

---

## 🔄 需要重构的文件

### 1. 更新导入路径

**文件：** `app/learning/[sessionId]/SessionClientPage.tsx`

```typescript
// ❌ 旧代码
import { CopilotWidget } from '@/app/components/ai/CopilotWidget';

// ✅ 新代码
import { CopilotWidget } from '@/app/components/ai/CopilotWidgetV2';
```

**文件：** `app/components/ai/AISidebar.tsx`

```typescript
// ❌ 旧代码
import { CopilotWidget } from '@/app/components/ai/CopilotWidget';

// ✅ 新代码
import { CopilotWidget } from '@/app/components/ai/CopilotWidgetV2';
```

### 2. 更新 API 调用

**文件：** `app/learning/LearningClientPage.tsx`

```typescript
// ❌ 旧代码
const res = await fetch('/api/learning/sessions', {
  method: 'POST',
  body: JSON.stringify({ context })
});

// ✅ 新代码
import { SessionAPI } from '@/lib/api/sessions';
const session = await SessionAPI.create({
  type: 'LEARNING',
  mode: 'TUTOR',
  context
});
```

### 3. 更新会话删除逻辑

**文件：** `app/learning/[sessionId]/SessionClientPage.tsx`

```typescript
// ❌ 旧代码
const res = await fetch(`/api/learning/sessions/${sessionId}`, {
  method: 'DELETE'
});

// ✅ 新代码
import { SessionAPI } from '@/lib/api/sessions';
await SessionAPI.delete(sessionId);
```

---

## 🗄️ 数据库清理

### 1. 删除冗余字段（可选）

**⚠️ 谨慎操作：** 确保新架构完全不依赖这些字段

```sql
-- 删除 messageCount 字段（已被 _count 替代）
ALTER TABLE learning_sessions DROP COLUMN IF EXISTS message_count;

-- 验证没有代码引用此字段
-- grep -r "messageCount" lib/ app/
```

### 2. 清理旧索引

```sql
-- 删除旧的索引（已被新索引替代）
DROP INDEX IF EXISTS learning_sessions_user_id_idx;
DROP INDEX IF EXISTS learning_sessions_user_id_updated_at_idx;
```

---

## 📝 代码搜索清单

在删除代码前，使用以下命令确保没有引用：

### 1. 检查旧 API 端点的引用
```bash
# 检查 /api/learning/chat 的引用
grep -r "/api/learning/chat" app/ lib/

# 检查 /api/ai/chat 的引用
grep -r "/api/ai/chat" app/ lib/

# 应该只在旧文件中找到引用
```

### 2. 检查旧 Hook 的引用
```bash
# 检查 useCopilot 的引用
grep -r "from '@/app/components/ai/useCopilot'" app/ lib/

# 检查 from './useCopilot'
grep -r "from './useCopilot'" app/
```

### 3. 检查旧组件的引用
```bash
# 检查旧 CopilotWidget 的引用
grep -r "from '@/app/components/ai/CopilotWidget'" app/ lib/

# 应该已经全部替换为 CopilotWidgetV2
```

### 4. 检查 SessionService 的引用
```bash
# 检查 SessionService 的引用
grep -r "SessionService" app/ lib/

# 应该已经替换为 SessionManager
```

---

## 🧹 清理步骤

### Phase 1: 标记废弃（第 1 周）

1. 在旧文件顶部添加废弃注释：
```typescript
/**
 * @deprecated This file is deprecated and will be removed in v2.0
 * Use the new API at /api/sessions instead
 * Migration guide: /CODE_MIGRATION_GUIDE.md
 */
```

2. 添加运行时警告：
```typescript
if (process.env.NODE_ENV === 'development') {
  console.warn('[DEPRECATED] This API endpoint is deprecated. Use /api/sessions instead.');
}
```

### Phase 2: 注释代码（第 2 周）

1. 注释掉旧的 API 端点
2. 监控错误日志
3. 确认没有请求到旧端点

### Phase 3: 删除代码（第 3-4 周）

1. 删除已注释的文件
2. 删除冗余的数据库字段
3. 更新文档

### Phase 4: 验证（第 4 周）

1. 运行所有测试
2. 检查生产环境日志
3. 确认没有错误

---

## ✅ 清理后验证

### 1. 运行测试
```bash
npm test
```

### 2. 检查 TypeScript 错误
```bash
npm run type-check
```

### 3. 检查 Linter 错误
```bash
npm run lint
```

### 4. 构建项目
```bash
npm run build
```

### 5. 检查未使用的导入
```bash
npx ts-prune
```

---

## 📊 清理效果预期

- **代码行数减少：** ~40% (约 2000+ 行)
- **文件数量减少：** ~10 个文件
- **包大小减少：** ~5-10%
- **构建时间减少：** ~10-15%
- **维护成本降低：** 显著

---

## 🔄 回滚计划

如果清理后出现问题：

1. **立即回滚：**
```bash
git revert <commit-hash>
git push origin main
```

2. **恢复特定文件：**
```bash
git checkout <commit-hash> -- path/to/file
```

3. **恢复数据库字段：**
```sql
ALTER TABLE learning_sessions 
  ADD COLUMN message_count INT DEFAULT 0;
```

---

## 📅 清理时间表

| 阶段 | 时间 | 任务 |
|------|------|------|
| Phase 1 | 第 1 周 | 标记废弃，添加警告 |
| Phase 2 | 第 2 周 | 注释代码，监控日志 |
| Phase 3 | 第 3 周 | 删除文件，清理数据库 |
| Phase 4 | 第 4 周 | 验证和监控 |

---

## 📞 支持

如有问题，请：
1. 查看 Git 历史记录
2. 参考迁移文档
3. 联系技术负责人

