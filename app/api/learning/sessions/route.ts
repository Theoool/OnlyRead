import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { SessionService } from '@/lib/core/learning/session.service';
import { z } from 'zod';
import { requireUserFromHeader } from '@/lib/supabase/user';

const CreateSessionSchema = z.object({
  context: z.object({
    articleIds: z.array(z.string()).optional(),
    collectionId: z.string().optional(),
    currentTopic: z.string().optional(),
    masteryLevel: z.number().optional()
  }).optional()
});

export async function GET(req: Request) {
  try {
 
    const user = await requireUserFromHeader(req)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sessions = await SessionService.listSessions(user.id);
    return NextResponse.json(sessions);
  } catch (error) {
    console.error("Failed to list sessions:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { context } = CreateSessionSchema.parse(body);

    const session = await SessionService.createSession(user.id, context);
    return NextResponse.json(session);
  } catch (error) {
    console.error("Failed to create session:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
