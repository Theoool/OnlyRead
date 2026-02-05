import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { IGraphState } from '../state';
import { emitAiEvent } from '../../streaming/context';

const RetrievalPolicySchema = z.object({
  enabled: z.boolean().describe('Whether to run retrieval'),
  mode: z.enum(['fast', 'comprehensive']).describe('Retrieval intensity'),
  topK: z.number().int().min(1).max(10).describe('How many candidates to retrieve'),
  minSimilarity: z.number().min(0).max(1).describe('Minimum similarity threshold for sources'),
  minSources: z.number().int().min(0).max(10).describe('Minimum sources required to proceed'),
  rewriteQuery: z.boolean().describe('Whether to rewrite query using chat history'),
  confidence: z.number().min(0).max(1).describe('Confidence of this retrieval policy decision'),
  reason: z.string().describe('Reason for the retrieval policy decision'),
});

const SupervisorOutputSchema = z.object({
  nextStep: z.enum(['explain', 'quiz', 'code', 'plan', 'end']),
  reasoning: z.string().describe("Why this step was chosen"),
  topic: z.string().describe("The specific sub-topic to focus on"),
  retrievalPolicy: RetrievalPolicySchema,
});

function clamp(n: number, min: number, max: number) {
  if (Number.isNaN(n)) return min
  return Math.max(min, Math.min(max, n))
}

function sanitizePolicy(input: any, fallback: any) {
  const enabled = typeof input?.enabled === 'boolean' ? input.enabled : fallback.enabled
  const mode = input?.mode === 'comprehensive' ? 'comprehensive' : 'fast'
  const topK = Math.round(clamp(Number(input?.topK ?? fallback.topK), 1, 10))
  const minSimilarity = clamp(Number(input?.minSimilarity ?? fallback.minSimilarity), 0, 1)
  const minSources = Math.round(clamp(Number(input?.minSources ?? fallback.minSources), 0, 10))
  const rewriteQuery = typeof input?.rewriteQuery === 'boolean' ? input.rewriteQuery : fallback.rewriteQuery
  const confidence = clamp(Number(input?.confidence ?? fallback.confidence), 0, 1)
  const reason = String(input?.reason ?? fallback.reason ?? '')
  return { enabled, mode, topK, minSimilarity, minSources, rewriteQuery, confidence, reason }
}

export const supervisorNode = async (state: IGraphState) => {
  emitAiEvent({ type: 'step', data: { name: 'supervisor' } })
  console.log(`[Supervisor] Mode: ${state.mode}, Message: ${state.userMessage}`);

  // 1. QA Mode: Short-circuit to direct answer
  if (state.mode === 'qa') {
      return {
          nextStep: 'direct_answer',
          reasoning: 'User requested fast QA mode.',
          currentTopic: 'General',
          retrievalPolicy: {
            enabled: true,
            mode: 'fast',
            topK: 5,
            minSimilarity: 0.2,
            minSources: 0,
            rewriteQuery: (state.messages?.length ?? 0) > 0,
            confidence: 0.8,
            reason: 'QA 模式默认需要检索资料片段以支撑回答。',
          },
      };
  }

  // 2. Copilot Mode: Default to explain, unless specific command
  if (state.mode === 'copilot') {
      // For now, treat copilot as "explain" with context awareness
      // We could add more logic here later (e.g. "summarize selection")
      const hasInlineContext = !!state.context?.selection || !!state.context?.currentContent
      const hasFilter = (state.articleIds?.length ?? 0) > 0 || !!state.collectionId
      const enabled = !hasInlineContext || hasFilter
      return {
          nextStep: 'explain', 
          reasoning: 'Copilot default action',
          currentTopic: 'Context Analysis',
          retrievalPolicy: {
            enabled,
            mode: 'fast',
            topK: 5,
            minSimilarity: 0.2,
            minSources: 0,
            rewriteQuery: false,
            confidence: 0.85,
            reason: enabled
              ? 'Copilot：缺少足够的内联上下文或存在过滤范围，执行检索补全资料。'
              : 'Copilot：已有选中文本/可见内容，优先基于内联上下文回答，跳过检索。',
          },
      };
  }

  // 3. Tutor Mode: Full LLM Routing
  const llm = new ChatOpenAI({
    modelName: process.env.AI_MODEL_NAME || 'gpt-4o',
    temperature: 0,
    apiKey: process.env.OPENAI_API_KEY,
    configuration: { baseURL: process.env.OPENAI_BASE_URL },
  });

  const systemPrompt = `You are the Supervisor of an Adaptive Learning System.
Your job is to decide:
1) next pedagogical step
2) a retrieval policy (whether to retrieve, mode, threshold, etc.)

Current Context:
- Topic: ${state.currentTopic || 'General'}
- Mastery: ${state.masteryLevel}

Input Context Signals:
- Has history: ${(state.messages?.length ?? 0) > 0}
- Has filters (articleIds/collectionId): ${(state.articleIds?.length ?? 0) > 0 || !!state.collectionId}
- Has inline reader context (selection/currentContent): ${!!state.context?.selection || !!state.context?.currentContent}

Rules:
1. "Start", "Analyze", "Plan", "Overview" -> 'plan'
2. Specific questions about content ("What is X?", "Explain Y", "How does Z work?") -> 'explain'
3. New topic or confusion -> 'explain'
4. Claims understanding -> 'quiz'
5. Wants practice -> 'code'
6. Goodbye/Off-topic -> 'end'

Retrieval Policy Guidance:
- If inline reader context is present and there is no filter scope, prefer enabled=false.
- If nextStep is 'plan', prefer mode='comprehensive' and higher topK.
- If nextStep is 'quiz' or 'code' and there is no filter scope, retrieval is often unnecessary.
- minSimilarity should be between 0.1 and 0.6 depending on strictness; higher => stricter.

Output ONLY a valid JSON object matching the required schema.`;

  const messages = [
    new SystemMessage(systemPrompt),
    ...(state.messages || []),
    new HumanMessage(state.userMessage)
  ];

  const chain = llm.withStructuredOutput(SupervisorOutputSchema);
  const result = await chain.invoke(messages);

  const hasFilter = (state.articleIds?.length ?? 0) > 0 || !!state.collectionId
  const hasInlineContext = !!state.context?.selection || !!state.context?.currentContent

  const defaultPolicy = {
    enabled: hasFilter || !hasInlineContext,
    mode: result.nextStep === 'plan' ? 'comprehensive' : 'fast',
    topK: result.nextStep === 'plan' ? 8 : 5,
    minSimilarity: 0.2,
    minSources: 0,
    rewriteQuery: (state.messages?.length ?? 0) > 0,
    confidence: 0.6,
    reason: 'Default fallback policy',
  }

  const retrievalPolicy = sanitizePolicy(result.retrievalPolicy, defaultPolicy)

  emitAiEvent({
    type: 'meta',
    data: {
      retrievalPolicy,
    },
  })

  return {
    nextStep: result.nextStep,
    reasoning: result.reasoning,
    currentTopic: result.topic,
    retrievalPolicy,
  };
};
