import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/infrastructure/database/prisma'
import { generateEmbedding } from '@/lib/infrastructure/ai/embedding'
import { createErrorResponse, createSuccessResponse } from '@/lib/infrastructure/api/response'
import { ChatOpenAI } from '@langchain/openai'
import { ChatPromptTemplate } from '@langchain/core/prompts'

const QaRequestSchema = z.object({
  question: z.string().min(1),
  topK: z.number().int().min(1).max(12).optional().default(6),
})

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
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return createSuccessResponse({ answer: '', sources: [], error: 'Unauthorized' }, 401)
    }

    const json = await req.json()
    const { question, topK } = QaRequestSchema.parse(json)

    let queryVector: number[]
    try {
      queryVector = await generateEmbedding(question)
    } catch (e) {
      return createSuccessResponse(
        {
          answer: '',
          sources: [],
          error: 'Embedding generation failed',
        },
        500
      )
    }

    const retrieved = await prisma.$queryRaw<
      Array<{
        id: string
        content: string
        articleId: string
        title: string | null
        domain: string | null
        similarity: number
      }>
    >`
      SELECT
        c.id,
        c.content,
        a.id as "articleId",
        a.title,
        a.domain,
        1 - (c.embedding <=> ${JSON.stringify(queryVector)}::vector(1536)) as similarity
      FROM article_chunks c
      JOIN articles a ON c.article_id = a.id
      WHERE c.user_id = ${user.id}::uuid
        AND a.deleted_at IS NULL
      ORDER BY similarity DESC
      LIMIT ${topK};
    `

    const sources = retrieved
      .map((r) => {
        return {
          articleId: r.articleId,
          title: r.title || '(untitled)',
          domain: r.domain,
          similarity: r.similarity,
          excerpt: r.content,
        }
      })

    const contextText =
      sources.length === 0
        ? '（没有检索到可用的资料片段）'
        : sources
            .map(
              (s, idx) =>
                `【资料${idx + 1}】标题：${s.title}\n来源：${s.domain || ''}\n片段：\n${s.excerpt}`
            )
            .join('\n\n')

    if (!process.env.AI_MODEL_NAME) {
      return createSuccessResponse({ answer: '', sources: [], error: 'AI_MODEL_NAME not set' }, 500)
    }

    const llm = new ChatOpenAI({
      modelName: process.env.AI_MODEL_NAME,
      temperature: 0.2,
      apiKey: process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY,
      configuration: {
        baseURL: process.env.OPENAI_BASE_URL,
      },
    });

    const prompt = ChatPromptTemplate.fromMessages([
      ["system", `你是一位「精准溯源型知识工程师」，专精于基于给定文本的严格事实核查与结构化输出。

## 核心工作原则
1. **绝对溯源**：每一个事实必须锚定到资料片段的具体文本，禁止常识补充、推理延伸或概括转述
2. **置信度诚实**：confidence 反映"资料支撑强度"，而非"答案看起来对不对"
3. **不确定时拒绝**：宁可输出"资料不足"，绝不编造或模糊表述`],
      ["user", `问题：{question}

资料片段：
{context}

要求：
1) 回答尽量简洁、结构清晰。
2) 每个关键结论都尽量给出 citations；quote 必须来自资料片段原文，且尽量短（<=120字）。
3) 如果没有资料片段或无法支撑结论，confidence 设为 <=0.3。`]
    ]);

    const chain = prompt.pipe(llm.withStructuredOutput(AnswerSchema));

    try {
      const result = await chain.invoke({
        question,
        context: contextText
      });

      return createSuccessResponse({
        ...result,
        sources,
      })
    } catch (e) {
       console.error("QA Generation failed", e);
       // Provide a graceful fallback or error
       return createSuccessResponse({ 
         answer: '抱歉，生成回答时遇到错误。', 
         confidence: 0, 
         citations: [], 
         followUpQuestions: [], 
         sources, 
         error: 'Generation failed' 
       }, 200) // Return 200 so UI shows the error message in the answer box if preferred, or 500.
    }

  } catch (error) {
    return createErrorResponse(error)
  }
}
