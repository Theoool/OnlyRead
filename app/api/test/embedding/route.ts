import { NextResponse } from 'next/server';
import { getOrCreateUser } from '@/lib/supabase/user';
import { apiHandler, createSuccessResponse } from '@/lib/infrastructure/api/response';
import { generateEmbedding } from '@/lib/infrastructure/ai/embedding';
import { prisma } from '@/lib/infrastructure/database/prisma';

/**
 * GET /api/test/embedding
 *
 * 诊断 API - 验证 embedding 系统是否正常工作
 *
 * 这个 API 会：
 * 1. 检查环境变量配置
 * 2. 测试 OpenAI API 连接
 * 3. 检查 pgvector 扩展
 * 4. 检查数据库 embedding 列
 * 5. 测试 embedding 生成
 * 6. 测试相似度搜索
 *
 * 使用方法：在浏览器访问 /api/test/embedding
 */
export const GET = apiHandler(async (req: Request) => {
  const diagnostics: {
    timestamp: string;
    checks: Array<{ name: string; status: string; details: unknown }>;
    issues: string[];
    recommendations: string[];
    overall?: string;
  } = {
    timestamp: new Date().toISOString(),
    checks: [],
    issues: [],
    recommendations: [],
  };

  // ============================================
  // 检查 1: 环境变量
  // ============================================
  const envChecks = {
    openaiApiKey: !!process.env.OPENAI_API_KEY,
    openaiBaseUrl: !!process.env.OPENAI_BASE_URL,
    databaseUrl: !!process.env.DATABASE_URL,
  };

  diagnostics.checks.push({
    name: '环境变量配置',
    status: envChecks.openaiApiKey && envChecks.openaiBaseUrl && envChecks.databaseUrl ? '✅ 通过' : '❌ 失败',
    details: envChecks,
  });

  if (!envChecks.openaiApiKey) {
    diagnostics.issues.push('OPENAI_API_KEY 未设置');
    diagnostics.recommendations.push('请在 .env 文件中添加: OPENAI_API_KEY=sk-your-key-here');
  }
  if (!envChecks.openaiBaseUrl) {
    diagnostics.issues.push('OPENAI_BASE_URL 未设置');
  }

  // ============================================
  // 检查 2: 测试 OpenAI API 连接
  // ============================================
  if (envChecks.openaiApiKey) {
    try {
      const startTime = Date.now();
      const testEmbedding = await generateEmbedding('测试文本');
      const duration = Date.now() - startTime;

      diagnostics.checks.push({
        name: 'OpenAI API 连接',
        status: '✅ 通过',
        details: {
          duration: `${duration}ms`,
          dimensions: testEmbedding.length,
          firstValue: testEmbedding[0],
          lastValue: testEmbedding[testEmbedding.length - 1],
        },
      });
    } catch (error: any) {
      diagnostics.checks.push({
        name: 'OpenAI API 连接',
        status: '❌ 失败',
        details: {
          error: error.message,
        },
      });
      diagnostics.issues.push(`OpenAI API 调用失败: ${error.message}`);
      diagnostics.recommendations.push('检查 API 密钥是否有效，是否有余额');
    }
  } else {
    diagnostics.checks.push({
      name: 'OpenAI API 连接',
      status: '⏭️ 跳过',
      details: { reason: 'OPENAI_API_KEY 未设置' },
    });
  }

  // ============================================
  // 检查 3: pgvector 扩展
  // ============================================
  try {
    const extensionCheck: any = await prisma.$queryRaw`
      SELECT * FROM pg_extension WHERE extname = 'vector'
    `;

    const hasExtension = Array.isArray(extensionCheck) && extensionCheck.length > 0;

    diagnostics.checks.push({
      name: 'pgvector 扩展',
      status: hasExtension ? '✅ 已启用' : '❌ 未启用',
      details: hasExtension ? extensionCheck[0] : null,
    });

    if (!hasExtension) {
      diagnostics.issues.push('pgvector 扩展未启用');
      diagnostics.recommendations.push('在 Supabase SQL Editor 中运行: CREATE EXTENSION IF NOT EXISTS vector;');
    }
  } catch (error) {
    diagnostics.checks.push({
      name: 'pgvector 扩展',
      status: '❌ 检查失败',
      details: { error },
    });
  }

  // ============================================
  // 检查 4: 数据库 embedding 列
  // ============================================
  try {
    const columnCheck: any = await prisma.$queryRaw`
      SELECT
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_name = 'concepts'
        AND column_name = 'embedding'
    `;

    const hasColumn = Array.isArray(columnCheck) && columnCheck.length > 0;

    diagnostics.checks.push({
      name: 'embedding 列',
      status: hasColumn ? '✅ 存在' : '❌ 不存在',
      details: hasColumn ? columnCheck[0] : null,
    });

    if (!hasColumn) {
      diagnostics.issues.push('embedding 列不存在');
      diagnostics.recommendations.push('请运行 prisma migrate 或手动添加列');
    }
  } catch (error) {
    diagnostics.checks.push({
      name: 'embedding 列',
      status: '❌ 检查失败',
      details: { error },
    });
  }

  // ============================================
  // 检查 5: 统计概念 embedding 数据
  // ============================================
  try {
    const stats: any = await prisma.$queryRaw`
      SELECT
        COUNT(*) as total,
        COUNT(embedding) as with_embedding,
        COUNT(*) - COUNT(embedding) as without_embedding
      FROM concepts
      WHERE deleted_at IS NULL
    `;

    diagnostics.checks.push({
      name: '概念 embedding 统计',
      status: 'ℹ️ 信息',
      details: stats[0],
    });

    if (stats[0].without_embedding > 0) {
      diagnostics.issues.push(`${stats[0].without_embedding} 个概念没有 embedding`);
      diagnostics.recommendations.push('运行批量生成脚本为旧概念生成 embedding');
    }
  } catch (error) {
    diagnostics.checks.push({
      name: '概念 embedding 统计',
      status: '❌ 检查失败',
      details: { error },
    });
  }

  // ============================================
  // 检查 6: 测试相似度搜索
  // ============================================
  if (envChecks.openaiApiKey) {
    try {
      const testEmbedding = await generateEmbedding('机器学习');

      // 测试相似度搜索
      const searchResults: any = await prisma.$queryRaw`
        SELECT
          id,
          term,
          1 - (embedding <=> ${`[${testEmbedding.join(',')}]`}::vector) as similarity
        FROM concepts
        WHERE embedding IS NOT NULL
          AND deleted_at IS NULL
        ORDER BY similarity DESC
        LIMIT 3
      `;

      diagnostics.checks.push({
        name: '相似度搜索',
        status: '✅ 正常',
        details: {
          query: '机器学习',
          resultsFound: searchResults.length,
          results: searchResults,
        },
      });
    } catch (error: any) {
      diagnostics.checks.push({
        name: '相似度搜索',
        status: '❌ 失败',
        details: { error: error.message },
      });
      diagnostics.issues.push(`相似度搜索失败: ${error.message}`);
    }
  }

  // ============================================
  // 总体评估
  // ============================================
  const criticalIssues = diagnostics.issues.filter((i: string) =>
    i.includes('未设置') || i.includes('未启用') || i.includes('不存在')
  );

  if (criticalIssues.length > 0) {
    diagnostics.overall = '❌ 存在严重问题';
    diagnostics.recommendations.push('⚠️ 请立即修复上述严重问题后再使用 embedding 功能');
  } else if (diagnostics.issues.length > 0) {
    diagnostics.overall = '⚠️ 部分问题';
    diagnostics.recommendations.push('建议修复上述问题以获得最佳体验');
  } else {
    diagnostics.overall = '✅ 系统正常';
    diagnostics.recommendations.push('🎉 Embedding 系统运行正常！');
  }

  return createSuccessResponse({ diagnostics });
});
