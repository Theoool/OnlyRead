# 🗺️ 开发路线图与任务清单 (Roadmap & Todos)

> 本文档基于 `STRATEGY.md` 的愿景，拆解为可执行的工程任务。严格遵循 `lib/core` 和 `lib/infrastructure` 的新架构规范。

## 🔴 P0: 核心体验修复与标准化 (The Foundation)
**目标**: 让系统极其稳定，数据结构为未来扩展做好准备。

- [ ] **统一错误处理系统 (Infrastructure)**
    - [ ] 创建 `lib/infrastructure/error/` 模块，定义标准应用异常。
    - [ ] 在 `app/error.tsx` 实现全局错误捕获 UI。
    - [ ] 封装 `try-catch` 装饰器或高阶函数，用于 Server Actions 和 API Route。
- [ ] **数据层规范化 (Infrastructure)**
    - [ ] 全面检查 `app/api/`，将所有散落的数据库操作迁移至 `lib/core/` 下的 Service。
    - [ ] 引入 `Zod` 对所有 API 输入输出进行严格运行时校验。
- [ ] **阅读器体验优化 (Core/UI)**
    - [ ] 优化 `Article` 数据模型，支持由 `blocks` 组成的结构化存储（为"边缘批注"做准备）。
    - [ ] 修复移动端阅读时的布局抖动问题。

## 🟡 P1: 知识连接引擎 (The Connectivity)
**目标**: 实现知识的自动关联与向量化基础。

- [ ] **向量数据库集成 (Infrastructure)**
    - [ ] 在 Supabase 中启用 `pgvector` 扩展。
    - [ ] 创建 `lib/infrastructure/vector/` 模块，封装向量嵌入 (Embeddings) 生成逻辑（调用 OpenAI 或本地模型）。
- [ ] **概念关联服务 (Core/Learning)**
    - [ ] 在 `Concept` 模型中添加 `embedding` 字段。
    - [ ] 实现 "Find Related Concepts" 功能：基于向量距离查找相似概念。
    - [ ] 开发 "Contextual Hints" 组件：在阅读页面，自动检测并高亮文中已有的概念。

## 🔵 P2: 可视化与第二大脑 (The Visualization)
**目标**: 让知识可见，让复习更有趣。

- [ ] **知识图谱视图 (UI)**
    - [ ] 集成 `react-force-graph` 或类似库。
    - [ ] 实现 `/graph` 页面，展示概念节点及其引用关系。
- [ ] **高级复习模式 (Core/Learning)**
    - [ ] 升级 SRS 算法，支持"反向复习"（看定义猜词）。
    - [ ] 实现"情境复习"：复习时展示该概念在不同文章中的原句。

## 🟢 P3: 本地优先与隐私 (The Sovereignty)
**目标**: 数据主权与离线可用。

- [ ] **离线同步引擎 (Infrastructure)**
    - [ ] 引入 `TanStack Query` 的 `persistQueryClient` 插件，实现基础的离线缓存。
    - [ ] 设计冲突解决策略（Last Write Wins 或手动合并）。
- [ ] **数据导出与备份 (Core/System)**
    - [ ] 实现全量数据导出为 Markdown/Obsidian 格式。
    - [ ] 实现 JSON 格式的完整备份与恢复。

---

## 📝 当前冲刺 (Current Sprint) - 建议立即执行

作为项目经理，我建议我们当前的冲刺专注于 **P0 的数据层规范化** 和 **P1 的向量化基础设施搭建**。

### 待办事项 (To-Do List)

1.  **Refactor**: 扫描 `app/api/articles/route.ts`，确保其完全调用 `lib/core/reading/articles.service.ts`，并添加 Zod 验证。
2.  **Refactor**: 扫描 `app/api/concepts/route.ts`，确保其完全调用 `lib/core/learning/concepts.service.ts`，并添加 Zod 验证。
3.  **Feat**: 在 Supabase 中执行 SQL 开启 `pgvector`（需提供 SQL 脚本）。
4.  **Feat**: 创建 `lib/infrastructure/ai/embedding.ts` 服务。
