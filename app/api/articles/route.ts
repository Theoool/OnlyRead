import { NextResponse } from 'next/server';
import { getOrCreateUser } from '@/lib/supabase/user';
import { apiHandler, createSuccessResponse } from '@/lib/infrastructure/error/response';
import { ArticlesRepository } from '@/lib/core/reading/articles.repository';
import { ArticleSchema } from '@/lib/shared/validation/schemas';
import { UnauthorizedError } from '@/lib/infrastructure/error';
import { IndexingService } from '@/lib/core/indexing/service';
import { prisma } from '@/lib/infrastructure/database/prisma';

// Helper to get authenticated user or throw
async function requireUser() {
  const user = await getOrCreateUser();
  if (!user) {
    throw new UnauthorizedError();
  }
  return user;
}

/**
 * GET /api/articles
 * List all articles with pagination and filtering
 * Query params:
 * - page: number (default: 1)
 * - pageSize: number (default: 20)
 * - type: string (optional)
 * - includeCollectionArticles: boolean (default: false)
 */
export const GET = apiHandler(async (req: Request) => {
  const user = await requireUser();
  const { searchParams } = new URL(req.url);

  // Pagination parameters
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || searchParams.get('limit') || '20');
  const type = searchParams.get('type') || undefined;
  const includeCollectionArticles = searchParams.get('includeCollectionArticles') === 'true';

  const result = await ArticlesRepository.findAll(user.id, {
    page,
    pageSize,
    type,
    includeCollectionArticles
  });

  return createSuccessResponse({
    articles: result.items,
    pagination: {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
      hasNext: result.hasNext,
      hasPrevious: result.hasPrevious,
    }
  });
});

/**
 * POST /api/articles
 * Create a new article
 */
export const POST = apiHandler(async (req: Request) => {
  const user = await requireUser();
  const json = await req.json();

  // Validate input
  const data = ArticleSchema.parse(json);

  const article = await ArticlesRepository.create(user.id, data);

  // Trigger Indexing (Chunking + Embedding) - Fire and Forget (Node.js runtime safe)
  (async () => {
    console.log(`[Background] Starting indexing for manually created article ${article.id}...`);
    
    // 1. Create Job Record
    let job;
    try {
      job = await prisma.job.create({
        data: {
          userId: user.id,
          type: 'GENERATE_EMBEDDING',
          status: 'PROCESSING',
          payload: { articleIds: [article.id], source: 'MANUAL_CREATE' },
          progress: 0
        }
      });
    } catch (e) {
      console.error('[Background] Failed to create job record', e);
    }

    // 2. Process Article
    try {
      await IndexingService.processArticle(article.id, user.id);
      
      // 3. Complete Job
      if (job) {
        await prisma.job.update({
          where: { id: job.id },
          data: { 
            status: 'COMPLETED', 
            progress: 100,
            result: { processed: 1, total: 1 }
          }
        });
      }
      console.log(`[Background] Indexing finished for manual article ${article.id}`);
    } catch (e) {
      console.error(`[Background] Indexing failed for ${article.id}`, e);
      if (job) {
        await prisma.job.update({
          where: { id: job.id },
          data: { 
            status: 'FAILED', 
            result: { error: String(e) }
          }
        }).catch(() => {});
      }
    }
  })().catch(e => console.error('[Background] Async execution failed', e));

  return createSuccessResponse({ article }, 201);
});
