import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiHandler, createSuccessResponse } from '@/lib/infrastructure/error/response';
import { UnauthorizedError, NotFoundError } from '@/lib/infrastructure/error';
import { prisma } from '@/lib/infrastructure/database/prisma';

// Helper to get authenticated user
async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new UnauthorizedError();
  }
  return user;
}

/**
 * GET /api/jobs/[id]
 * Get job status and progress
 */
export const GET = apiHandler(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await params;

  const job = await prisma.job.findUnique({
    where: {
      id,
      userId: user.id, // 确保用户只能查看自己的 job
    },
    select: {
      id: true,
      type: true,
      status: true,
      progress: true,
      result: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!job) {
    throw new NotFoundError('Job');
  }

  return createSuccessResponse({ job });
});

