您指出的非常对。我之前的设计过于关注“交互逻辑”，而完全忽略了“知识源头”这个核心问题。**没有基于用户文档的 RAG (检索增强生成)，AI 导师就是无源之水，无法根据用户实际学习的材料进行个性化教学。**

目前的 `Learningdemo` 完全是在“裸奔”，依靠 LLM 自身的通用知识，这与本项目“Anti-AI Reader”（深度阅读助手）的初衷背道而驰。

### 核心问题分析

1. **缺失 Context**: 当前的 Supervisor 和 Generators 没有任何输入文档上下文。
2. **RAG 缺位**: `qa/route.ts` 中已经实现了成熟的向量检索逻辑（Query -> Embedding -> Vector Search -> Context Construction），但这套逻辑没有集成到 Learning Graph 中。
3. **状态隔离**: Learning Graph 的 `state` 中缺少 `contextDocs` 或 `retrievedChunks` 字段。

### 修正计划：将 RAG 深度集成到 LangGraph 工作流中

我们需要将 `qa/route.ts` 中的检索能力“搬”进 `Learning Graph`，构建多文档优势，使其成为一个**具备 RAG 能力的自适应教学系统**。

#### 1. 状态定义升级 (`lib/core/learning/graph/state.ts`)

在 `LearningGraphState` 中增加 RAG 相关的字段：

* `documents`: 存储检索到的相关文档片段（作为教学素材）。

* `vectorQuery`: 用户的查询意图向量。

#### 2. 新增检索节点 (`lib/core/learning/graph/nodes/retriever.ts`)

创建一个新的 `retrieverNode`，复用 `qa/route.ts` 中的核心检索逻辑：

* 接收用户的 `userMessage` 或 Supervisor 提取的 `searchQuery`。

* 调用 `generateEmbedding` 生成向量。

* 查询 `article_chunks` 表，获取 top-K 相关片段。

* 将检索到的内容写入 State 的 `documents` 字段。

#### 3. 改造现有节点 (Inject Context)

让所有的生成器节点（Explanation, Quiz, Code）都能“看到”检索到的文档：

* **ExplanationAgent**: "Based on the following document excerpts: {documents}, explain {topic}..."

* **QuizAgent**: "Generate a quiz based strictly on the facts in these documents: {documents}..."

#### 4. 调整图结构 (`lib/core/learning/graph/index.ts`)

新的工作流将变为：
`Start` -> `Supervisor` (决定意图) -> **`Retriever`** **(获取知识)** -> `[Explain | Quiz | Code]` -> `End`

或者更智能的：
`Start` -> `Retriever` (先找资料) -> `Supervisor` (基于资料和问题决定策略) -> `[Generators]`

\*考虑到用户意图可能不需要检索（比如简单的打招呼），保留 Supervisor 先行可能更灵活，但为了确保教学质量，\*\*“先检索后决策”**或**“决策后按需检索”\**是必须的。*

**修正后的执行路径：**

1. **Refactor State**: 更新 `LearningGraphState` 引入文档上下文。
2. **Create Retriever**: 封装检索逻辑为 LangGraph Node。
3. **Update Prompts**: 修改所有 Agent 的 Prompt，强制要求基于 `State.documents` 生成内容。
4. **Update Graph**: 将 Retriever 节点插入工作流。

这将使 `Learningdemo` 真正变成一个\*\*“基于你所读文章的 AI 导师”\*\*，而不是一个通用的 ChatGPT 聊天机器人。
