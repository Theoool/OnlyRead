我完全理解您的不满。目前的系统存在两个致命的断层：

1.  **后端返回与前端期望的 Schema 不匹配**：
    *   您提供的 JSON 示例显示 AI 返回了 `type: "code"` 但内容却是一个选择题（Description 是问题，Solution 是 "C"）。这说明 **Prompt 和 Schema 定义混乱**，导致 AI "胡言乱语"，把选择题塞进了代码题的格式里。
    *   Result: 前端拿到 `type: code` 渲染出了代码编辑器，但用户看到的却是文字选择题，根本无法交互。

2.  **交互入口错误（"用户拖拽内容开始"）**：
    *   目前的入口是简单的聊天框 `Hi! I'm your Tutor`。
    *   您的核心需求是 **"基于文档的交互"**：用户应该先拖入文档（Context），然后 AI 基于这篇文档生成交互（Quiz/Explain），而不是空对空地聊天。现在的流程完全是割裂的。

### 详细需求规划与重构方案

我将从 **交互入口** 到 **AI 工作流** 再到 **数据协议** 进行全链路重构。

#### Phase 1: 重构交互入口（Drag & Drop Context）
*   **目标**：将“聊天室”改造为“文档工作台”。
*   **Action**:
    *   改造 `app/learning/page.tsx`。
    *   移除开场的 "Hi" 废话。
    *   增加一个显著的 **File Dropzone / Document Selector**。
    *   **新流程**：用户拖入 PDF/Text -> 前端解析/上传 -> 获取 `documentId` -> 触发 AI 分析 -> AI 生成第一个交互组件（如“这篇文章讲了什么”或“核心概念图谱”）。

#### Phase 2: 修复 AI 工作流与 Schema (Strict Typing)
*   **目标**：杜绝 AI 返回错误的 UI 类型（如把选择题当代码题发）。
*   **Action**:
    *   **分离 Prompt**: `QuizAgent` 和 `CodeAgent` 必须使用完全隔离的 Prompt，严禁混淆。
    *   **Schema 校验**: 在后端增加 Zod 校验层，如果 `type: 'code'` 但内容不包含 `starterCode`，直接驳回重试或降级处理。
    *   **Retriever 增强**: 检索节点必须显式绑定到用户上传的 `documentId`，而不是泛泛地搜全库。

#### Phase 3: 前端渲染引擎适配 (Robust Rendering)
*   **目标**：让 UI 能够容错，并且支持“基于文档”的特殊交互。
*   **Action**:
    *   增加 `DocumentViewer` 组件（分屏左侧）：展示用户拖入的文档原文。
    *   **高亮联动**：当右侧 AI 解释某段话时，左侧原文自动高亮对应段落（Citation Highlight）。

### 立即执行计划 (本轮 Focus)

鉴于问题的严重性，本轮我将优先解决 **API/Schema 混乱** 和 **基于文档的入口** 问题。

1.  **修正 Schema**: 严格区分 `Quiz` 和 `Code` 的定义，并在后端强制校验。
2.  **改造 Page**: 增加文档上下文选择（模拟），并强制 AI 基于该文档生成。
3.  **修复 Prompt**: 重写 `generators.ts`，确保 `CodeAgent` 只生成代码，`QuizAgent` 只生成选择题。

这样可以确保：用户拖入文档 -> AI 准确理解 -> AI 返回正确的 UI 组件 -> 前端正确渲染。
