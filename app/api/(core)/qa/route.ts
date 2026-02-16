import { z } from 'zod'
import { requireUserFromHeader } from '@/lib/supabase/user'
import { createErrorResponse, createSuccessResponse } from '@/lib/infrastructure/error/response'
import { ChatOpenAI } from '@langchain/openai'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { QaRequestSchema } from '@/lib/shared/validation/schemas'
import { RetrievalService } from '@/lib/core/ai/retrieval/service'

const AnswerSchema = z.object({
  answer: z.string().describe("回答正文（中文）"),
  confidence: z.number().describe("0-1 的小数,反映资料支撑强度"),
  citations: z.array(z.object({
    articleId: z.string().describe("UUID of the article"),
    title: z.string().describe("Title of the article"),
    quote: z.string().describe("用于支撑回答的原文摘录"),
  })).describe("List of citations supporting the answer"),
  followUpQuestions: z.array(z.string()).describe("可选的追问列表"),
});

export async function POST(req: Request) {
  try {
    const user = await requireUserFromHeader(req);

    const json = await req.json()
    const { question, topK, articleIds, collectionId } = QaRequestSchema.parse(json)

    console.log(`[QA API] Question: "${question.substring(0, 50)}...", userId: ${user.id}`);
    console.log(`[QA API] Filter - articleIds: ${articleIds?.length || 0}, collectionId: ${collectionId || 'none'}`);

    const { documents: contextText, sources } = await RetrievalService.search({
      query: question,
      userId: user.id,
      topK,
      filter: { 
        articleIds,
        collectionId
      }
    });

    console.log(`[QA API] Retrieved ${sources.length} sources, context length: ${contextText.length} chars`);

    if (!process.env.AI_MODEL_NAME) {
      return createSuccessResponse({ answer: '', sources: [], error: 'AI_MODEL_NAME not set' }, 500)
    }

    const hasContext = contextText.trim().length > 0;

    const llm = new ChatOpenAI({
      modelName: process.env.AI_MODEL_NAME,
      temperature: 0.7,
      apiKey: process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY,
      configuration: {
        baseURL: process.env.OPENAI_BASE_URL,
      },
    });

    const contextMessage = hasContext
      ? contextText
      : '（未找到相关资料。请确保已导入文档并选择正确的上下文范围。）';

    const systemPrompt = hasContext
      ? `你是一位「精准溯源型知识工程师」，专精于基于给定文本的严格事实核查与结构化输出。

## 核心工作原则
1. **绝对溯源**：每一个事实必须锚定到资料片段的具体文本，禁止常识补充、推理延伸或概括转述
2. **置信度诚实**：confidence 反映"资料支撑强度"，而非"答案看起来对不对"
3. **不确定时拒绝**：宁可输出"资料不足"，绝不编造或模糊表述`
      : `你是一位知识库问答助手。当前用户的问题无法在知识库中找到相关资料。

## 回应原则
1. **诚实告知**：明确告知用户未能在其文档中找到相关信息
2. **可能原因**：
   - 文档尚未导入或索引
   - 选择的文章/合集中不包含相关内容
   - 问题表述与文档内容差异较大
3. **建议**：建议用户检查文档导入状态或调整问题表述`;

    const prompt = ChatPromptTemplate.fromMessages([
      ["system", systemPrompt],
      ["user", `问题：{question}

资料片段：
{context}

要求：
1) 回答尽量简洁、结构清晰。
2) 每个关键结论都尽量给出 citations；quote 必须来自资料片段原文，且尽量短（<=120字）。
3) 如果没有资料片段或无法支撑结论，confidence 设为 <=0.3，并明确告知用户。`]
    ]);

    const chain = prompt.pipe(llm.withStructuredOutput(AnswerSchema));

    try {
      const result = await chain.invoke({
        question,
        context: contextMessage
      });

      return createSuccessResponse({
        ...result,
        sources,
      })
    } catch (e) {
      console.error("QA Generation failed", e);
      return createSuccessResponse({
        answer: '抱歉，生成回答时遇到错误。',
        confidence: 0,
        citations: [],
        followUpQuestions: [],
        sources,
        error: 'Generation failed'
      }, 200)
    }

  } catch (error) {
    return createErrorResponse(error)
  }
}

