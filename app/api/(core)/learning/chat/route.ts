import { createSuccessResponse, createErrorResponse } from '@/lib/infrastructure/api/response';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { SessionService } from '@/lib/core/learning/session.service';
import { unifiedGraph } from '@/lib/core/ai/graph/workflow';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';

const ChatRequestSchema = z.object({
  sessionId: z.string().uuid(),
  message: z.string(),
});

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return createSuccessResponse({ error: "Unauthorized" }, 401);
    }

    const json = await req.json();
    const { sessionId, message } = ChatRequestSchema.parse(json);

    const session = await SessionService.getSession(sessionId, user.id);
    if (!session) {
      return createErrorResponse(new Error("Session not found"));
    }

    const context = session.context as any || {};
    const articleIds = context.articleIds || [];
    const history = session.messages.map(m => ({
      role: m.role,
      content: m.content
    }));

    await SessionService.addMessage(sessionId, 'user', message);

    const baseMessages = history.map((m) => {
      const role = String(m.role || '').toLowerCase();
      const content = String(m.content || '');
      if (role === 'assistant' || role === 'ai') return new AIMessage(content);
      if (role === 'system') return new SystemMessage(content);
      return new HumanMessage(content);
    });

    console.log(`[ChatAPI] Invoking unifiedGraph for session ${sessionId}. Context Articles: ${articleIds.length}`);
    const finalState: any = await unifiedGraph.invoke({
      messages: baseMessages,
      userMessage: message,
      userId: user.id,
      mode: 'tutor',
      context: {
        selection: context.selection,
        currentContent: context.currentContent,
      },
      articleIds: articleIds,
      collectionId: context.collectionId,
      currentTopic: context.currentTopic || 'General',
      masteryLevel: context.masteryLevel || 0,
    } as any);

    const finalResponse = finalState?.finalResponse;
    if (!finalResponse) {
      console.error("[ChatAPI] unifiedGraph returned no finalResponse");
      return createSuccessResponse({
        ui: { type: "explanation", content: "I'm having trouble processing that right now." },
        sources: []
      });
    }

    const ui = finalResponse.ui;
    const sources = finalResponse.sources;
    
    let content = "";
    if (ui.type === 'explanation') content = ui.content;
    else if (ui.type === 'quiz') content = ui.question;
    else if (ui.type === 'code') content = ui.description;
    else content = JSON.stringify(ui);

    await SessionService.addMessage(sessionId, 'assistant', content, {
      ui: ui,
      sources: sources
    });

    console.log(`[ChatAPI] Success. Sources used: ${finalResponse.sources?.length || 0}`);
    if ((finalResponse.sources?.length ?? 0) > 0) {
        console.log(`[ChatAPI] Source Titles: ${finalResponse.sources?.map((s: any) => s.title).join(', ')}`);
    }

    return createSuccessResponse(finalResponse);

  } catch (error) {
    console.error('Chat API Error:', error);
    return createErrorResponse(error);
  }
}

