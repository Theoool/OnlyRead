# 数据库迁移指南

## 概述
本迁移将为 `learning_sessions` 和 `learning_messages` 表添加新的字段和索引，以支持更完善的会话管理功能。

## 迁移步骤

### 1. 备份数据库（重要！）
```bash
# 使用 pg_dump 备份数据库
pg_dump -h your-host -U your-user -d your-database > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 2. 运行迁移脚本
```bash
# 方式 1: 使用 psql 直接执行
psql -h your-host -U your-user -d your-database -f prisma/migrations/add_session_management_fields.sql

# 方式 2: 使用 Prisma Migrate (推荐)
npx prisma migrate dev --name add_session_management_fields
```

### 3. 验证迁移
```sql
-- 检查新字段是否添加成功
SELECT 
  column_name, 
  data_type, 
  column_default 
FROM information_schema.columns 
WHERE table_name = 'learning_sessions' 
  AND column_name IN ('type', 'status', 'mode', 'last_activity_at');

-- 检查索引是否创建成功
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'learning_sessions';

-- 检查数据完整性
SELECT 
  COUNT(*) as total_sessions,
  COUNT(CASE WHEN type IS NOT NULL THEN 1 END) as with_type,
  COUNT(CASE WHEN status IS NOT NULL THEN 1 END) as with_status,
  COUNT(CASE WHEN mode IS NOT NULL THEN 1 END) as with_mode,
  COUNT(CASE WHEN last_activity_at IS NOT NULL THEN 1 END) as with_activity
FROM learning_sessions;
```

### 4. 更新 Prisma Client
```bash
# 重新生成 Prisma Client
npx prisma generate
```

### 5. 重启应用
```bash
# 重启你的 Next.js 应用
npm run dev  # 开发环境
# 或
pm2 restart your-app  # 生产环境
```

## 回滚步骤（如果需要）

如果迁移出现问题，可以使用以下步骤回滚：

```sql
-- 1. 删除新添加的索引
DROP INDEX IF EXISTS idx_sessions_user_status_activity;
DROP INDEX IF EXISTS idx_sessions_user_type_status;

-- 2. 删除新添加的列
ALTER TABLE learning_sessions 
  DROP COLUMN IF EXISTS type,
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS mode,
  DROP COLUMN IF EXISTS last_activity_at;

ALTER TABLE learning_messages 
  DROP COLUMN IF EXISTS metadata;

-- 3. 删除枚举类型
DROP TYPE IF EXISTS "SessionType";
DROP TYPE IF EXISTS "SessionStatus";
DROP TYPE IF EXISTS "ModeType";
DROP TYPE IF EXISTS "MessageRole";

-- 4. 恢复备份（如果需要）
psql -h your-host -U your-user -d your-database < backup_YYYYMMDD_HHMMSS.sql
```

## 注意事项

1. **生产环境迁移**：建议在低峰期执行，并提前通知用户
2. **数据验证**：迁移后务必验证数据完整性
3. **监控**：迁移后密切监控应用性能和错误日志
4. **渐进式部署**：建议先在测试环境验证，再部署到生产环境

## 兼容性说明

- 旧代码仍然可以访问 `learning_sessions` 表，因为我们只是添加了新字段
- 新字段都有默认值，不会影响现有数据
- `messageCount` 字段暂时保留，可以在确认新架构稳定后删除

## 性能影响

- 新增索引会略微增加写入开销（约 5-10%）
- 查询性能将显著提升（预计提升 30-50%）
- 建议在迁移后运行 `ANALYZE learning_sessions;` 更新统计信息

