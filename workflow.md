### 细步骤说明 1. 初始化与校验
- 鉴权 : 通过 requireUserFromHeader(req) 验证用户身份。
- 参数解析 : 使用 Zod Schema 解析请求体，支持以下核心参数：
  - messages / message : 用户发送的消息。
  - sessionId : 会话 ID（用于历史记录）。
  - mode : 模式选择 ( qa | tutor | copilot )，默认为 qa 。
  - context : 包含 articleIds , collectionId , selection (选中文本), currentContent (当前可见内容)。 2. 知识库检索 (RAG)
- 调用服务 : RetrievalService.search 。
- 输入 : 用户的最后一条消息 ( lastMessage )。
- 过滤条件 : 基于 userId 以及请求中的 articleIds 或 collectionId 限定检索范围。
- 输出 : 获取相关的文档片段 ( contextText ) 和来源元数据 ( sources )。 3. Prompt 构建策略
根据 mode 参数动态构建 System Prompt：

- QA 模式 (qa) : 严格的知识助手，仅基于提供的上下文回答，如果找不到答案则明确告知。
- 阅读副驾驶 (copilot) : 辅助阅读，上下文包含当前文档内容，解释用户选中的文本或回答相关问题，语气乐于助人。
- 导师模式 (tutor) : 引导用户从上下文中学习。
- 上下文增强 : 如果存在用户选中的文本 ( selection ) 或当前屏幕可见内容 ( currentContent )，会追加到 Prompt 中以增强相关性。 4. LLM 执行
- 模型配置 : 使用 ChatOpenAI ，加载环境变量 AI_MODEL_NAME ，温度设为 0.3 (较低，偏向准确性)。
- Prompt 组装 :
  - System: 上一步生成的 Prompt。
  - User: Question: {question}\n\nContext:\n{context} 。
- 流式生成 : 创建 Chain ( prompt.pipe(llm) ) 并发起流式调用。 5. 响应处理与副作用 (Side Effects)
- 流转换 : 将 LangChain 的对象流转换为文本字节流 (Text Stream) 返回给前端。
- 元数据返回 : 将检索到的参考来源 ( sources ) 放入响应头 X-Copilot-Sources 中。
- 异步持久化 (Callback) : 在 handleLLMEnd 回调中处理（不阻塞首字节响应）：
  1. 会话检查 : 检查数据库中是否存在 sessionId ，不存在则创建（标题根据模式自动生成）。
  2. 存用户消息 : 将用户提问存入 LearningMessage 表。
  3. 存 AI 消息 : 将 AI 完整回复及来源信息 ( sources ) 存入 LearningMessage 表。
