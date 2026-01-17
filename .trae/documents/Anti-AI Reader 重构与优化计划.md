# Anti-AI Reader 全面重构计划 (Comprehensive Refactor Plan)

基于对项目现状的深度分析和新的数据库设计，我制定了以下重构计划。本计划旨在消除冗余、提升性能并确立最佳实践。

## 核心目标
1.  **架构瘦身**：移除所有 `deprecated`、`legacy` 和重复的中间层代码。
2.  **性能飞跃**：实施数据库垂直分表 (`Article` vs `ArticleBody`) 和原生全文搜索。
3.  **规范统一**：强制使用 `lib/core` (领域逻辑) + `lib/infrastructure` (基础设施) 的分层架构。

---

## 第一阶段：数据库重构与迁移 (Database Refactoring)
**目标**：建立支持高性能搜索和分表存储的新数据底层。

1.  **更新 Schema**：应用新的 `prisma/schema.prisma` 设计。
    *   拆分 `Article` -> `Article` (元数据) + `ArticleBody` (大文本)。
    *   添加 `tsvector` 字段支持全文搜索。
    *   建立 `Concept` -> `Article` 的实体关联。
    *   添加 `Job` 和 `Tag` 表。
2.  **数据迁移**：
    *   生成并应用 Prisma Migration。
    *   (可选) 编写脚本将现有 `Article.content` 迁移到 `ArticleBody` 表（如果是生产环境需要，开发环境可重置）。

## 第二阶段：代码清理与去重 (Cleanup & Deduplication)
**目标**：删除"幽灵代码"，确保全项目只有一个"真理来源"。

1.  **删除遗留文件**：
    *   🗑️ `lib/legacy/` 目录 (包含 `articles-legacy.ts`, `stats.ts`)。
    *   🗑️ `lib/articles.ts` (根目录的废弃入口)。
    *   🗑️ `lib/prisma.ts` (根目录的废弃单例)。
    *   🗑️ `lib/api/articles.ts` (多余的中间层)。
2.  **修复引用**：
    *   全局搜索并替换 `import { prisma } from '@/lib/prisma'` -> `import { prisma } from '@/lib/infrastructure/database/prisma'`。
    *   将所有文章相关调用指向 `lib/core/reading/articles.service.ts`。

## 第三阶段：核心逻辑升级 (Core Logic Upgrade)
**目标**：适配分表设计，修复 "Select *" 性能陷阱。

1.  **重构 Repository (`lib/core/reading/articles.repository.ts`)**：
    *   `create`: 使用 Prisma Transaction 同时写入 `Article` 和 `ArticleBody`。
    *   `findById`: 默认**不查询**内容。新增 `findContentById` 或 `findById({ withContent: true })` 方法。
    *   `update`: 仅当 `content` 字段存在时更新 `ArticleBody`。
    *   `search`: 移除内存过滤逻辑，改用 `prisma.$queryRaw` 调用 PostgreSQL 全文搜索。
2.  **重构 Service (`lib/core/reading/articles.service.ts`)**：
    *   适配 Repository 的变更，确保上层业务逻辑（如导入、解析）正确处理分表。

## 第四阶段：API 路由优化 (API Optimization)
**目标**：移除 Node.js 层面的 CPU 密集型操作。

1.  **重写搜索接口 (`app/api/search/route.ts`)**：
    *   **现状**：加载所有文章内容 -> Node.js 正则匹配 -> 截取片段 (极慢)。
    *   **重构**：直接调用 Repository 的全文搜索方法，由数据库返回高亮片段 ( `ts_headline`)。
2.  **优化单页接口 (`app/api/articles/[id]/route.ts`)**：
    *   明确区分"获取元数据"和"开始阅读"两种场景，避免不必要的带宽消耗。

## 第五阶段：任务系统集成 (Job System Integration)
**目标**：提升长耗时操作的用户体验。

1.  **文件导入异步化**：
    *   修改 `app/api/import/file/route.ts`，不再同步等待解析，而是创建 `Job` 记录并立即返回 `jobId`。
2.  **前端轮询**：
    *   (后续迭代) 实现简单的轮询 hook 检查 `Job` 状态。

---

## 执行清单 (Action Items)

### 1. 立即执行 (Immediate Actions)
- [ ] 覆盖 `prisma/schema.prisma`。
- [ ] 运行 `prisma migrate dev`。
- [ ] 删除 `lib/legacy/`, `lib/articles.ts`, `lib/prisma.ts`。
- [ ] 全局替换错误的 `prisma` 引用。

### 2. 核心重写 (Core Rewrite)
- [ ] 修改 `ArticlesRepository` 适配 `ArticleBody` 分表。
- [ ] 重写 `ArticlesRepository.search` 使用原生 SQL。
- [ ] 修复 `app/api/search/route.ts`。

### 3. 验证 (Verification)
- [ ] 运行单元测试 (如果有)。
- [ ] 手动测试文件导入和阅读功能。
- [ ] 验证搜索速度。
