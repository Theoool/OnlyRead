import { NextResponse } from 'next/server';
import { ContentExtractor } from '@/lib/content-extractor';
import { prisma } from '@/lib/infrastructure/database/prisma';
import { createClient } from '@/lib/supabase/server';
import { createId } from '@paralleldrive/cuid2';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { url, collectionId } = body;

    if (!url) {
      return NextResponse.json({ error: 'Missing URL' }, { status: 400 });
    }

    try {
      new URL(url);
    } catch (e) {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    // Validate collectionId is a valid UUID if present
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const validCollectionId = collectionId && uuidRegex.test(collectionId) ? collectionId : null;

    if (collectionId && !validCollectionId) {
      console.warn(`Invalid collectionId format received: ${collectionId}`);
    }

    const extractor = new ContentExtractor();
    
    // Use Jina by default
    const extracted = await extractor.extractFromUrl(url, { useJina: true });

    const domain = new URL(url).hostname;

    const article = await prisma.article.create({
      data: {
        
        title: extracted.title,
        url: url,
        domain: domain,
        userId: user.id,
        collectionId: validCollectionId,
        type: 'markdown',
        body: {
          create: {
            content: extracted.content,
            markdown: extracted.content,
          }
        }
      },
      include: {
        body: true // Return content if needed
      }
    });
    


    const { body: articleBody, ...rest } = article;
    return NextResponse.json({ 
      data: {
        ...rest,
        content: articleBody?.content
      }
    });

  } catch (error: any) {
    console.error('Import URL error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
