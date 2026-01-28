我深刻反省。我之前的修改确实脱离了项目既有的架构，引入了 Mock 数据和随意的数据结构，这是不可接受的。

我已经仔细审阅了 `prisma/schema.prisma` 和 `app/api/` 目录下的代码，重新理解了项目的核心设计：
1.  **数据模型**：项目基于 `Article` (文章) 和 `ArticleChunk` (向量化切片) 构建。`Collection` 用于管理书籍/系列。`User` 通过 `userId` 拥有这些资源。
2.  **多文档架构**：Learning 不应基于 Mock 数据，而应基于真实的 `Article` 或 `Collection`。用户拖拽或选择的应该是数据库中已存在的 `Article`。
3.  **API 规范**：现有的 API（如 `api/qa`, `api/articles`）都有明确的 Supabase Auth 鉴权和 Prisma 查询模式。

### 纠错与重构计划

我将立即废弃之前的 Mock 实现，严格基于现有的 Prisma Schema 和 API 模式重构 `Learning` 模块。

#### 1. 修正数据源 (Data Source) - 严禁 Mock
*   **前端 (`app/learning/page.tsx`)**:
    *   废弃 `DEMO_DOCS`。
    *   使用 `useSWR` 或 `fetch` 调用 `/api/articles` 获取用户真实的文档列表。
    *   支持选择多个 `Article` 或整个 `Collection` 作为 Context。
    *   **拖拽上传**: 复用 `/api/import/file` 接口，实现真正的文件上传 -> 解析 -> 入库 -> 向量化流程。

#### 2. 修正检索逻辑 (Retriever) - 基于真实 Schema
*   **后端 (`lib/core/learning/graph/nodes/retriever.ts`)**:
    *   接收前端传来的 `articleIds` (Array<UUID>)。
    *   构建 Prisma 查询：`WHERE c.user_id = ... AND c.article_id IN (...)`。
    *   这才是真正的“多文档”支持。

#### 3. 修正 API 路由 (`app/api/Learningdemo/route.ts`)
*   输入参数不再是随意的 JSON，而是严格匹配：
    ```typescript
    {
      userMessage: string;
      context: {
        articleIds: string[]; // 必须是 UUID
        collectionId?: string;
      }
    }
    ```

#### 4. 恢复项目一致性
*   删除所有 Mock 代码。
*   确保所有数据库操作都通过 `prisma` 实例进行。
*   确保所有鉴权都通过 `supabase.auth.getUser()`。

我将按照这个计划，把 `Learning` 模块“大换血”，使其成为项目有机的一部分，而不是一个外挂的 Demo。
