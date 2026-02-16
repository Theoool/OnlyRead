import { z } from 'zod'
import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { HumanMessage, AIMessage, SystemMessage, BaseMessage } from '@langchain/core/messages'
import { requireUserFromHeader } from '@/lib/supabase/user'
import { createErrorResponse } from '@/lib/infrastructure/error/response'
import { prisma } from '@/lib/infrastructure/database/prisma'
import { unifiedGraph } from '@/lib/core/ai/graph/workflow'
import { runWithAiStreamContext } from '@/lib/core/ai/streaming/context'
import { encodeSseEvent } from '@/lib/core/ai/streaming/sse'
import { SummaryService } from '@/lib/core/learning/summary.service'

const ChatRequestSchema = z.object({
  messages: z.array(z.any()).optional(),
  message: z.string().optional(),
  sessionId: z.string().optional(),
  mode: z.enum(['qa', 'tutor', 'copilot']).default('qa'),
  uiIntent: z.string().optional(),
  currentTopic: z.string().optional(),
  masteryLevel: z.number().optional(),
  context: z
    .object({
      articleIds: z.array(z.string()).optional(),
      collectionId: z.string().optional(),
      selection: z.string().optional(),
      currentContent: z.string().optional(),
    })
    .optional(),
})

export const runtime = 'nodejs'

function isUuid(value: unknown): value is string {
  if (typeof value !== 'string') return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim(),
  )
}

function toBaseMessages(input: any[] | undefined): BaseMessage[] {
  if (!input || input.length === 0) return []
  return input
    .map((m) => {
      const role = String(m?.role ?? '').toLowerCase()
      const content = typeof m?.content === 'string' ? m.content : JSON.stringify(m?.content ?? '')
      if (role === 'ASSISTANT' || role === 'ai') return new AIMessage(content)
      if (role === 'SYSTEM') return new SystemMessage(content)
      return new HumanMessage(content)
    })
    .filter(Boolean)
}

export async function POST(req: Request) {
  let user
  let parsed
  try {
    user = await requireUserFromHeader(req)
    parsed = ChatRequestSchema.parse(await req.json())
  } catch (error) {
    return createErrorResponse(error)
  }

  const { messages, message: legacyMessage, sessionId, mode, uiIntent, context, currentTopic, masteryLevel } = parsed
  const sanitizedArticleIds = Array.isArray(context?.articleIds)
    ? Array.from(
        new Set(
          context.articleIds
            .map((v: any) => (typeof v === 'string' ? v.trim() : ''))
            .filter((v: string) => v.length > 0 && isUuid(v)),
        ),
      )
    : []
  const sanitizedCollectionId = isUuid(context?.collectionId) ? context?.collectionId : undefined

  const lastMessage =
    messages && messages.length > 0 ? (messages[messages.length - 1]?.content as any) : legacyMessage
  const userMessage = typeof lastMessage === 'string' ? lastMessage.trim() : String(lastMessage ?? '').trim()

  if (!userMessage) {
    return createErrorResponse(new Error('Message is required'))
  }

  const baseMessages = toBaseMessages(messages?.slice(0, -1))
  const traceId = randomUUID()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder()
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(encodeSseEvent(event, data)))
      }

      const abort = () => {
        try {
          send('done', { traceId, aborted: true })
        } finally {
          controller.close()
        }
      }

      if (req.signal) req.signal.addEventListener('abort', abort, { once: true })

      send('meta', { traceId, mode, sessionId: sessionId || null })

      const emitter = {
        emit: (evt: any) => {
          send(evt.type, { ...evt.data, traceId })
        },
      }

      try {
        const finalState: any = await runWithAiStreamContext({ emitter, traceId }, async () => {
          return unifiedGraph.invoke({
            messages: baseMessages,
            userMessage,
            userId: user.id,
            mode,
            uiIntent,
            context: {
              selection: context?.selection,
              currentContent: context?.currentContent,
            },
            articleIds: sanitizedArticleIds,
            collectionId: sanitizedArticleIds.length > 0 ? undefined : sanitizedCollectionId,
            currentTopic: currentTopic || 'General',
            masteryLevel: masteryLevel ?? 0,
          } as any)
        })

        const finalResponse: any = finalState?.finalResponse
        if (!finalResponse) {
          send('error', { message: 'No finalResponse' })
          send('done', { traceId })
          controller.close()
          return
        }

        if (sessionId) {
          try {
            const session = await prisma.learningSession.findUnique({ where: { id: sessionId } })
            if (!session) {
              await prisma.learningSession.create({
                data: {
                  id: sessionId,
                  userId: user.id,
                  title: mode === 'qa' ? 'QA Session' : 'Learning Session',
                },
              })
            }

            await prisma.learningMessage.create({
              data: {
                sessionId,
                role: 'USER',
                content: userMessage,
            },
            })

            const ui: any = finalResponse.ui
            const sources = (finalResponse.sources || []).map((s: any) => ({
              title: (s.title || '').slice(0, 200),
              articleId: s.articleId,
              url: null,
            }))

            let content = ''
            if (ui?.type === 'explanation') content = ui.content
            else if (ui?.type === 'quiz') content = ui.question
            else if (ui?.type === 'code') content = ui.description
            else content = JSON.stringify(ui ?? {})

            await prisma.learningMessage.create({
              data: {
                sessionId,
                role:'ASSISTANT',
                content,
                ui,
                sources,
              },
            })

          
            
            const sessionForSummary = await prisma.learningSession.findUnique({
              where: { id: sessionId },
              select: { 
                _count: { select: { messages: true } },  // 返回 { _count: { messages: N } }
                summary: true 
              }
            })
            
            
            if (sessionForSummary && SummaryService.shouldGenerateSummary(
              sessionForSummary._count.messages,
              !!sessionForSummary.summary
            )) {
              // Generate summary in background
              SummaryService.generateAndSaveSummary(sessionId).catch(err => {
                console.error('[ChatAPI] Background summary generation failed:', err)
              })
            }
          } catch (e) {
            send('error', { message: 'Failed to persist session', detail: String(e) })
          }
        }

        send('final', finalResponse)
        send('done', { traceId })
        controller.close()
      } catch (e) {
        send('error', { message: 'Invocation failed', detail: String(e) })
        send('done', { traceId })
        controller.close()
      } finally {
        if (req.signal) req.signal.removeEventListener('abort', abort as any)
      }
    },
  })

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
