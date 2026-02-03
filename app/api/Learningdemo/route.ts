import { createSuccessResponse, createErrorResponse } from '@/lib/infrastructure/api/response';
import { learningGraph } from '@/lib/core/learning/graph';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

// Input schema for the request
const LearningRequestSchema = z.object({
  userMessage: z.string(),
  history: z.array(z.any()).optional().default([]),
  context: z.object({
    currentTopic: z.string().optional(),
    masteryLevel: z.number().optional().default(0),
    articleIds: z.array(z.string().uuid()).optional(), // Strict UUIDs
    collectionId: z.string().uuid().optional(),
  }).optional().default({ masteryLevel: 0 })
});

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser();

    if (authError || !user) {
      if (authError) {
        console.error("Auth check failed:", authError);
        // If it's a network error, we might want to tell the client
        if (authError.message.includes("fetch failed") || authError.message.includes("undici")) {
          return createErrorResponse(new Error("Database connection execution failed. Please check your network connection (VPN/Proxy)."));
        }
      }
      return createSuccessResponse({ error: "Unauthorized" }, 401);
    }

    const userId = user.id;
    const json = await req.json();
    const { userMessage, history, context } = LearningRequestSchema.parse(json);

    // Invoke the LangGraph Workflow
    // The graph manages the flow: Supervisor -> Retriever -> Specific Agent -> Result
    const finalState = await learningGraph.invoke({
      messages: history,
      userMessage: userMessage,
      userId: userId,
      articleIds: context.articleIds, // Pass real UUIDs
      collectionId: context.collectionId,
      currentTopic: context.currentTopic,
      masteryLevel: context.masteryLevel,
    } as any);

    if (!finalState.finalResponse) {
      // Fallback if graph ended without response (e.g. 'end' state)
      return createSuccessResponse({
        reasoning: "Session ended or no action needed.",
        ui: { type: 'explanation', content: "Is there anything else I can help you with?" }
      });
    }

    return createSuccessResponse(finalState.finalResponse);

  } catch (error) {
    console.error('Learning Graph Error:', error);
    return createErrorResponse(error);
  }
}
