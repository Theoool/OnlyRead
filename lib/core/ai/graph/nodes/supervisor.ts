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

// UI Intent for Pedagogical UI Strategy
const UIIntentSchema = z.enum([
  'text',         // Plain text/markdown explanation
  'mindmap',      // Concept visualization / knowledge graph
  'flashcard',    // Memory cards for key terms
  'quiz',         // Multiple choice questions
  'fill_blank',   // Fill-in-the-blank exercises
  'timeline',     // Chronological visualization
  'comparison',   // A vs B comparison table
  'simulation',   // Interactive simulation with sliders
  'code_sandbox', // Code exercises
  'summary',      // Structured summary with key points
]);

const SupervisorOutputSchema = z.object({
  nextStep: z.enum(['explain', 'quiz', 'code', 'plan', 'end']),
  learningMode: z.enum(['macro', 'micro']).describe("'macro' for overview/plan, 'micro' for detailed Q&A"),
  uiIntent: UIIntentSchema.describe('Best UI format for the response'),
  reasoning: z.string().describe("Why this step and UI were chosen"),
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

  // 1. QA Mode: Route to explain but with micro focus
  if (state.mode === 'qa') {
    return {
      nextStep: 'explain',
      learningMode: 'micro' as const,
      uiIntent: 'text' as const,
      reasoning: 'User requested fast QA mode. Using adaptive explanation.',
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

  // 2. Copilot Mode: Default to explain with context awareness
  if (state.mode === 'copilot') {
    const hasInlineContext = !!state.context?.selection || !!state.context?.currentContent
    const hasFilter = (state.articleIds?.length ?? 0) > 0 || !!state.collectionId
    const enabled = !hasInlineContext || hasFilter
    return {
      nextStep: 'explain',
      learningMode: 'micro' as const,
      uiIntent: 'text' as const,
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

  // Build context information for the prompt
  const hasArticleFilter = (state.articleIds?.length ?? 0) > 0;
  const hasCollectionFilter = !!state.collectionId;
  const hasSelection = !!state.context?.selection;
  const hasCurrentContent = !!state.context?.currentContent;
  
  const contextSection = [];
  if (hasArticleFilter) {
    contextSection.push(`- Article IDs: ${state.articleIds?.join(', ')}`);
  }
  if (hasCollectionFilter) {
    contextSection.push(`- Collection ID: ${state.collectionId}`);
  }
  if (hasSelection) {
    contextSection.push(`- User Selection: "${state.context?.selection?.slice(0, 200)}${(state.context?.selection?.length ?? 0) > 200 ? '...' : ''}"`);
  }
  if (hasCurrentContent) {
    contextSection.push(`- Current Content: "${state.context?.currentContent?.slice(0, 500)}${(state.context?.currentContent?.length ?? 0) > 500 ? '...' : ''}"`);
  }
  
  const systemPrompt = `You are the Supervisor of an Adaptive Learning System.
Your job is to decide:
1) next pedagogical step (nextStep)
2) learning mode: macro (overview/planning) vs micro (detailed Q&A)
3) UI intent: what visual format best serves the user
4) retrieval policy

Current Context:
- Topic: ${state.currentTopic || 'General'}
- Mastery: ${state.masteryLevel}

Input Context Signals:
- Has history: ${(state.messages?.length ?? 0) > 0}
- Has filters (articleIds/collectionId): ${hasArticleFilter || hasCollectionFilter}
- Has inline reader context (selection/currentContent): ${hasSelection || hasCurrentContent}

${contextSection.length > 0 ? `\nActive Context Details:\n${contextSection.join('\n')}\n` : ''}
=== ROUTING RULES ===

**nextStep decision:**
- "Start", "Analyze", "Plan", "Overview", "Summarize", "总结", "概述", "大纲" -> 'plan'
- Specific questions ("What is X?", "Explain Y", "How does Z work?", "为什么", "怎么") -> 'explain'
- New topic or confusion -> 'explain'
- Claims understanding, "test me", "测试", "考考我" -> 'quiz'
- Wants coding practice -> 'code'
- Goodbye/Off-topic -> 'end'

**learningMode decision:**
- 'macro': User wants GLOBAL understanding (plans, summaries, overviews, first encounter)
- 'micro': User wants SPECIFIC details (questions, explanations, following up)

**uiIntent decision (CRITICAL for user engagement):**
Choose the BEST visual format based on content and user intent:

| User Intent / Content | Best uiIntent |
|----------------------|---------------|
| Overview / Structure | 'mindmap' - shows concept relationships |
| Summary / Key points | 'summary' - structured takeaways |
| Comparing concepts | 'comparison' - side-by-side table |
| Historical / Process | 'timeline' - chronological view |
| Key terms to memorize | 'flashcard' - for active recall |
| Understanding check | 'quiz' - multiple choice |
| Active recall test | 'fill_blank' - fill in blanks |
| Math / Physics / Logic | 'simulation' - interactive variables |
| Programming practice | 'code_sandbox' - runnable code |
| Simple explanation | 'text' - markdown text |

Prefer rich UI (mindmap, simulation, comparison) over plain text when it enhances understanding!

Retrieval Policy Guidance:
- When article/collection filters are present, ENABLE retrieval to supplement context with relevant document fragments
- For factual questions (authors, definitions, dates, etc.), ALWAYS enable retrieval even with inline context
- If inline reader context is present BUT no filters, prefer enabled=false (rely on provided context)
- If nextStep is 'plan' or learningMode is 'macro', prefer mode='comprehensive' and higher topK
- If nextStep is 'quiz' or 'code' and there is no filter scope, retrieval is often unnecessary
- For explanation/understanding steps, enable retrieval to provide supporting evidence

Output ONLY a valid JSON object matching the required schema.`;

  const messages = [
    new SystemMessage(systemPrompt),
    ...(state.messages || []),
    new HumanMessage(state.userMessage)
  ];

  try {
    const chain = llm.withStructuredOutput(SupervisorOutputSchema, {
      name: 'supervisor_decision',
      method: 'functionCalling'
    });
    const result = await chain.invoke(messages);

    const hasFilter = (state.articleIds?.length ?? 0) > 0 || !!state.collectionId
    const hasInlineContext = !!state.context?.selection || !!state.context?.currentContent

    const defaultPolicy = {
      enabled: hasFilter,  // 有文章/集合过滤时总是启用检索
      mode: result.nextStep === 'plan' || result.learningMode === 'macro' ? 'comprehensive' : 'fast',
      topK: result.nextStep === 'plan' ? 8 : 5,
      minSimilarity: 0.2,
      minSources: 0,
      rewriteQuery: (state.messages?.length ?? 0) > 0,
      confidence: 0.6,
      reason: 'Default fallback policy',
    }

    const retrievalPolicy = sanitizePolicy(result.retrievalPolicy, defaultPolicy)

    console.log(`[Supervisor] nextStep=${result.nextStep}, learningMode=${result.learningMode}, uiIntent=${result.uiIntent}`);
    console.log(`[Supervisor] Reasoning: ${result.reasoning}`);

    emitAiEvent({
      type: 'meta',
      data: {
        retrievalPolicy,
        learningMode: result.learningMode,
        uiIntent: result.uiIntent,
      },
    })

    return {
      nextStep: result.nextStep,
      learningMode: result.learningMode,
      uiIntent: result.uiIntent,
      reasoning: result.reasoning || 'No reasoning provided',
      currentTopic: result.topic || 'General',
      retrievalPolicy,
    };
  } catch (error) {
    console.error('[Supervisor] Structured output failed, falling back to default:', error);
    
    // Fallback to default tutor behavior
    const hasFilter = (state.articleIds?.length ?? 0) > 0 || !!state.collectionId
    const hasInlineContext = !!state.context?.selection || !!state.context?.currentContent
    
    const fallbackPolicy = {
      // 在阅读器场景中，优先启用检索
      enabled: hasFilter,  // 有文章过滤时启用检索
      mode: 'fast' as const,
      topK: 5,
      minSimilarity: 0.2,
      minSources: 0,
      rewriteQuery: (state.messages?.length ?? 0) > 0,
      confidence: 0.5,
      reason: 'Fallback: using article filter for retrieval',
    }
    
    emitAiEvent({
      type: 'meta',
      data: {
        retrievalPolicy: fallbackPolicy,
        learningMode: 'micro',
        uiIntent: 'text',
      },
    })
    
    return {
      nextStep: 'explain' as const,
      learningMode: 'micro' as const,
      uiIntent: 'text' as const,
      reasoning: 'Fallback: using default explanation mode',
      currentTopic: 'General',
      retrievalPolicy: fallbackPolicy,
    };
  }
};
