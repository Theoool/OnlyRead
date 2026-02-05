import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { IGraphState } from '../state'
import { emitAiEvent } from '../../streaming/context'

export const queryRewriteNode = async (state: IGraphState) => {
  emitAiEvent({ type: 'step', data: { name: 'query_rewrite' } })

  const hasHistory = (state.messages?.length ?? 0) > 0
  const enabled = !!state.retrievalPolicy?.enabled && !!state.retrievalPolicy?.rewriteQuery && hasHistory

  if (!enabled) {
    return { retrievalQuery: state.userMessage }
  }

  const llm = new ChatOpenAI({
    modelName: process.env.AI_MODEL_NAME || 'gpt-4o',
    temperature: 0,
    apiKey: process.env.OPENAI_API_KEY,
    configuration: { baseURL: process.env.OPENAI_BASE_URL },
  })

  const system = new SystemMessage(
    '你是一个“问题改写器”。给定对话历史与追问，请把追问改写为包含全部语境的独立问题。只输出改写后的问题本身，不要回答问题，不要添加任何解释。',
  )

  const historyText = state.messages
    .slice(-6)
    .map((m: any) => `${m._getType?.() || m.constructor?.name}: ${m.content}`)
    .join('\n')

  const user = new HumanMessage(
    `对话历史：\n${historyText}\n\n追问：${state.userMessage}\n\n独立问题：`,
  )

  try {
    const result = await llm.invoke([system, user])
    const rewritten =
      typeof result.content === 'string' ? result.content.trim() : String(result.content ?? '').trim()
    if (!rewritten) return { retrievalQuery: state.userMessage }
    return { retrievalQuery: rewritten }
  } catch {
    return { retrievalQuery: state.userMessage }
  }
}
