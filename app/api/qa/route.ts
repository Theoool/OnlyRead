import { OpenAI } from 'openai'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/infrastructure/database/prisma'
import { generateEmbedding } from '@/lib/infrastructure/ai/embedding'
import { createErrorResponse, createSuccessResponse } from '@/lib/infrastructure/api/response'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
})

const QaRequestSchema = z.object({
  question: z.string().min(1),
  topK: z.number().int().min(1).max(12).optional().default(6),
})

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

    const systemPrompt = `你是一个严谨的中文知识库问答助手。你只能依据给定的“资料片段”回答问题。
如果资料不足以回答，必须明确说“不确定/资料不足”，并说明缺少什么信息。
输出必须是 JSON 对象，结构如下：
{
  "answer": "回答正文（中文）",
  "confidence": 0-1 的小数,
  "citations": [
    { "articleId": "uuid", "title": "标题", "quote": "用于支撑回答的原文摘录" }
  ],
  "followUpQuestions": ["可选的追问1", "可选的追问2"]
}`

    const userPrompt = `问题：${question}

资料片段：
${contextText}

要求：
1) 回答尽量简洁、结构清晰。
2) 每个关键结论都尽量给出 citations；quote 必须来自资料片段原文，且尽量短（<=120字）。
3) 如果没有资料片段或无法支撑结论，confidence 设为 <=0.3。`

    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL_NAME || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 800,
    })

    const content = completion.choices?.[0]?.message?.content || '{}'
    let parsed: any
    try {
      parsed = JSON.parse(content)
    } catch {
      parsed = { answer: content, confidence: 0.2, citations: [], followUpQuestions: [] }
    }

    return createSuccessResponse({
      ...parsed,
      sources,
    })
  } catch (error) {
    return createErrorResponse(error)
  }
}

