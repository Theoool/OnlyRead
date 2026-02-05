# Anti-AI Reader: RAG 智能交互系统重构与整合方案

## 1. 愿景 (Vision)

构建一个统一的、上下文感知的 **"Second Brain" (第二大脑)** 伴读系统。
该系统将打通现有的 `QA`（问答）、`Learning`（深度辅导）和 `Read`（沉浸阅读）模块，消除数据与逻辑孤岛。无论用户身处何处（在阅读器中、在独立问答页、或在学习会话中），都能通过统一的接口调用底层强大的检索与推理能力。

---

## 2. 现状分析 (Current State)

| 维度 | QA 模块 (`app/qa`) | Learning 模块 (`app/learning`) | Read 模块 (`app/read`) |
| :--- | :--- | :--- | :--- |
| **定位** | 快速事实查证 | 深度多轮辅导、测验 | 沉浸式阅读、高亮 |
| **后端实现** | 独立的 SQL 检索 + 简单的 LLM 调用 | 复杂的 LangGraph 状态机 + Session 管理 | 仅前端展示，无直接 AI 交互 |
| **检索逻辑** | 直接写在 API Route 中 (Raw SQL) | 分散在 Graph Node 中 (Raw SQL) | 无 |
| **交互形式** | 单轮问答 | 多轮对话 | 静态文本 |
| **痛点** | 代码重复，逻辑无法复用 | 过于厚重，难以嵌入其他页面 | 缺乏 AI 辅助，阅读过程断裂 |

---

## 3. 目标架构 (Target Architecture)

我们将引入一个新的核心层 `lib/core/ai` 来统一所有 AI 相关逻辑。

### 3.1 目录结构变更

```text
lib/
  core/
    ai/                     <-- [NEW] 统一 AI 核心
      retrieval/
        service.ts          <-- 统一检索引擎 (Hybrid Search)
        types.ts
      graph/
        nodes/              <-- 复用原有 Learning Node，增加 QA Node
        workflow.ts         <-- 统一工作流定义
        state.ts
      orchestrator.ts       <-- 对外统一门面 (Facade)
      types.ts
app/
  api/
    ai/
      chat/                 <-- [NEW] 统一 API 入口
        route.ts
  components/
    ai/                     <-- [NEW] 统一 UI 组件库
      CopilotWidget.tsx     <-- 核心聊天组件
      MessageBubble.tsx
      SourceList.tsx
```

### 3.2 核心组件设计

#### A. 统一检索服务 (`RetrievalService`)
不再在 API 路由中手写 SQL。封装标准化的检索接口：

```typescript
interface RetrievalOptions {
  query: string;
  userId: string;
  filter?: {
    articleIds?: string[];
    collectionId?: string;
    domain?: string;
  };
  mode?: 'comprehensive' | 'fast'; // 全面模式(包含摘要) vs 快速模式(仅片段)
  topK?: number;
}

class RetrievalService {
  async search(options: RetrievalOptions): Promise<SearchResult[]> {
    // 1. 生成 Embedding
    // 2. 构建动态 SQL (处理过滤条件)
    // 3. 执行混合检索 (Vector + Keyword)
    // 4. 返回标准化结果
  }
}
```

#### B. 统一认知图谱 (`UnifiedGraph`)
将 QA 视为 Graph 的一种特殊路径。

*   **状态 (State)**: 增加 `mode` 字段。
*   **路由逻辑 (Supervisor)**:
    *   `mode='qa'` -> `DirectAnswerNode` -> `End`
    *   `mode='tutor'` -> `Supervisor` -> `Plan/Quiz/Code` -> `End`
    *   `mode='copilot'` (阅读器侧边栏) -> `ContextAwareNode` -> `End`

#### C. 统一 API (`/api/ai/chat`)
前端只需调用这一个接口：

```typescript
POST /api/ai/chat
{
  "message": "什么是RAG？",
  "sessionId": "...",       // 可选，无则新建
  "mode": "qa" | "tutor" | "copilot",
  "context": {              // 灵活注入上下文
    "currentArticleId": "...",
    "selectedText": "..."
  }
}
```

---

## 4. 实施路线图 (Implementation Roadmap)

### Phase 1: 基础设施重构 (Infrastructure)
> **目标**: 提取公用逻辑，建立 `lib/core/ai`。

1.  创建 `lib/core/ai/retrieval` 目录。
2.  迁移 `app/api/qa/route.ts` 和 `lib/core/learning/graph/nodes/retriever.ts` 中的 SQL 逻辑到 `RetrievalService`。
3.  统一 Embedding 错误处理和 fallback 机制。
4.  **验证**: 编写单元测试或脚本验证 `RetrievalService` 能正确返回结果。

### Phase 2: 后端逻辑整合 (Backend Integration)
> **目标**: 构建支持多模式的 Unified Graph。

1.  将 `lib/core/learning/graph` 迁移至 `lib/core/ai/graph`。
2.  修改 Graph State，增加 `mode` 和 `context` 字段。
3.  新增 `DirectAnswerNode` (用于快速 QA)。
4.  创建统一 API `/api/ai/chat`，对接 Graph。

### Phase 3: UI 组件化 (UI Standardization)
> **目标**: 构建可复用的 Chat Widget。

1.  提取 `app/learning/components/ChatInterface.tsx` 为通用组件 `CopilotWidget`。
2.  实现三种变体 (Variant):
    *   `FullPage` (用于 QA/Learning 页)
    *   `Sidebar` (用于阅读页侧边栏)
    *   `Floating` (悬浮球，备用)
3.  重构 `app/qa/page.tsx` 使用 `CopilotWidget`。

### Phase 4: 阅读器集成 (Reader Integration)
> **目标**: 实现“边读边问”的闭环。

1.  在 `app/read/EpubReader.tsx` (及其他 Reader) 中集成 `CopilotWidget (Sidebar)`。
2.  实现上下文注入：打开 Sidebar 时自动传入 `articleId`。
3.  实现**划词交互**:
    *   用户划选文本 -> 弹出 "Ask AI" -> 点击 -> 打开 Sidebar 并发送 "解释这段话: {selection}"。

---

## 5. 关键集成点细节

### 5.1 侧边栏 (Sidebar) 交互设计
在 `app/read/layout.tsx` 或 `page.tsx` 中预留右侧抽屉位置。

*   **默认状态**: 收起。
*   **触发方式**: 顶部导航栏 "AI 助手" 按钮，或划词菜单。
*   **状态保持**: 切换文章时，聊天记录是否清空？建议：
    *   `mode='copilot'` 时，Session 绑定于 Article。切换文章自动切换 Session。

### 5.2 引用跳转优化
当 AI 回复中包含 `[1]` 引用时：
*   **当前**: 点击跳转新页面。
*   **优化**:
    *   如果在阅读页面内：点击直接**滚动**到对应段落并**高亮**。
    *   如果在 QA 页面：点击跳转到阅读页并定位。

---

## 6. 下一步行动 (Action Items)

建议立即开始 **Phase 1: 基础设施重构**。
我们将首先创建 `RetrievalService`，这是所有上层功能的基础。
