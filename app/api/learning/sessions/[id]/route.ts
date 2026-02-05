import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { SessionService } from '@/lib/core/learning/session.service';
import { requireUserFromHeader } from '@/lib/supabase/user';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {

  try {

  
 const user = await requireUserFromHeader(req);
const {id} =await params
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const session = await SessionService.getSession(id, user.id);
    if (!session) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    
    return NextResponse.json(session);
  } catch (error) {
    console.error("Failed to get session:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
      const {id} =await params
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
  
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
  
      await SessionService.deleteSession(id, user.id);
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("Failed to delete session:", error);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  }
