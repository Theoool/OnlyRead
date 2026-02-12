import { NextResponse } from 'next/server';
import { prisma } from '@/lib/infrastructure/database/prisma';
import { createClient } from '@/lib/supabase/server';
import { IndexingService } from '@/lib/core/indexing/service';

export const runtime = 'nodejs';
// Increase timeout for sync processing
export const maxDuration = 300; 

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { articleId } = body;

    if (!articleId) {
      return NextResponse.json({ error: 'Missing articleId' }, { status: 400 });
    }

    console.log(`[IndexingTrigger] Manually triggering index for ${articleId}`);

    // Verify ownership
    const article = await prisma.article.findUnique({
      where: { id: articleId },
      select: { userId: true }
    });

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    if (article.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 1. Create Job (Sync)
    const job = await prisma.job.create({
      data: {
        userId: user.id,
        type: 'GENERATE_EMBEDDING',
        status: 'PROCESSING',
        payload: { articleIds: [articleId], source: 'MANUAL_TRIGGER' },
        progress: 0
      }
    });

    // 2. Process (Sync - blocking response)
    try {
      await IndexingService.processArticle(articleId, user.id, user);
      
      // Update Job
      await prisma.job.update({
        where: { id: job.id },
        data: { 
          status: 'COMPLETED', 
          progress: 100,
          result: { success: true }
        }
      });

      return NextResponse.json({ success: true, jobId: job.id });

    } catch (error: any) {
      console.error(`[IndexingTrigger] Failed:`, error);
      
      await prisma.job.update({
        where: { id: job.id },
        data: { 
          status: 'FAILED', 
          result: { error: String(error) }
        }
      });

      return NextResponse.json({ 
        success: false, 
        error: error.message || String(error),
        jobId: job.id 
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('[IndexingTrigger] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
