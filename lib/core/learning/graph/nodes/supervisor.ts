import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { z } from 'zod';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

const RouterOutputSchema = z.object({
  nextStep: z.enum(['explain', 'quiz', 'code', 'plan', 'end']),
  reasoning: z.string().describe("Why this step was chosen"),
  topic: z.string().describe("The specific sub-topic to focus on"),
});

export const supervisorNode = async (state: any) => {
  const llm = new ChatOpenAI({
    modelName: process.env.AI_MODEL_NAME || 'gpt-4o',
    temperature: 0,
    apiKey: process.env.OPENAI_API_KEY,
    configuration: { baseURL: process.env.OPENAI_BASE_URL },
  });

  const systemPrompt = `You are the Supervisor of an Adaptive Learning System.
Your job is ONLY to decide the next pedagogical step based on the user's input and history.

Current Context:
- Topic: ${state.currentTopic || 'General'}
- Mastery: ${state.masteryLevel}

Rules:
1. "Start", "Analyze", "Plan", "Overview" -> 'plan'
2. Specific questions about content ("What is X?", "Explain Y", "How does Z work?") -> 'explain'
3. New topic or confusion -> 'explain'
4. Claims understanding -> 'quiz'
5. Wants practice -> 'code'
6. Goodbye/Off-topic -> 'end'

Output a JSON decision.`;

  const messages = [
    new SystemMessage(systemPrompt),
    ...(state.messages || []),
    new HumanMessage(state.userMessage)
  ];

  const chain = llm.withStructuredOutput(RouterOutputSchema);
  const result = await chain.invoke(messages);

  return {
    nextStep: result.nextStep,
    reasoning: result.reasoning,
    currentTopic: result.topic,
  };
};
