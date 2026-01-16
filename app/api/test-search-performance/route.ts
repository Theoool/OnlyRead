import { prisma } from '@/lib/infrastructure/database/prisma'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * 搜索性能测试 API
 * 用于验证 pg_trgm 索引效果
 *
 * 使用方法：
 * GET /api/test-search-performance?query=机器学习
 *
 * 返回：搜索执行时间和性能分析
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const query = searchParams.get('query') || '测试'

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const results: any = {
      query,
      timestamp: new Date().toISOString(),
      tests: [],
    }

    // ============================================
    // 测试 1: Concepts 搜索 - term 字段
    // ============================================
    const test1Start = performance.now()
    const concepts1 = await prisma.$queryRaw`
      SELECT id, term, my_definition
      FROM concepts
      WHERE user_id = ${user.id}::uuid
        AND deleted_at IS NULL
        AND term ILIKE ${`%${query}%`}
      LIMIT 20
    `
    const test1Duration = performance.now() - test1Start

    results.tests.push({
      name: 'Concepts - term 字段搜索',
      query: `term ILIKE '%${query}%'`,
      resultCount: Array.isArray(concepts1) ? concepts1.length : 0,
      duration: `${test1Duration.toFixed(2)}ms`,
    })

    // ============================================
    // 测试 2: Concepts 搜索 - my_definition 字段
    // ============================================
    const test2Start = performance.now()
    const concepts2 = await prisma.$queryRaw`
      SELECT id, term, my_definition
      FROM concepts
      WHERE user_id = ${user.id}::uuid
        AND deleted_at IS NULL
        AND my_definition ILIKE ${`%${query}%`}
      LIMIT 20
    `
    const test2Duration = performance.now() - test2Start

    results.tests.push({
      name: 'Concepts - my_definition 字段搜索',
      query: `my_definition ILIKE '%${query}%'`,
      resultCount: Array.isArray(concepts2) ? concepts2.length : 0,
      duration: `${test2Duration.toFixed(2)}ms`,
    })

    // ============================================
    // 测试 3: Concepts 搜索 - 多字段组合
    // ============================================
    const test3Start = performance.now()
    const concepts3 = await prisma.$queryRaw`
      SELECT id, term, my_definition
      FROM concepts
      WHERE user_id = ${user.id}::uuid
        AND deleted_at IS NULL
        AND (
          term ILIKE ${`%${query}%`} OR
          my_definition ILIKE ${`%${query}%`} OR
          my_example ILIKE ${`%${query}%`}
        )
      LIMIT 20
    `
    const test3Duration = performance.now() - test3Start

    results.tests.push({
      name: 'Concepts - 多字段组合搜索',
      query: `term OR my_definition OR my_example ILIKE '%${query}%'`,
      resultCount: Array.isArray(concepts3) ? concepts3.length : 0,
      duration: `${test3Duration.toFixed(2)}ms`,
    })

    // ============================================
    // 测试 4: Articles 搜索 - title 字段
    // ============================================
    const test4Start = performance.now()
    const articles1 = await prisma.$queryRaw`
      SELECT id, title, content
      FROM articles
      WHERE user_id = ${user.id}::uuid
        AND deleted_at IS NULL
        AND title ILIKE ${`%${query}%`}
      LIMIT 20
    `
    const test4Duration = performance.now() - test4Start

    results.tests.push({
      name: 'Articles - title 字段搜索',
      query: `title ILIKE '%${query}%'`,
      resultCount: Array.isArray(articles1) ? articles1.length : 0,
      duration: `${test4Duration.toFixed(2)}ms`,
    })

    // ============================================
    // 测试 5: Articles 搜索 - content 字段（大文本）
    // ============================================
    const test5Start = performance.now()
    const articles2 = await prisma.$queryRaw`
      SELECT id, title, content
      FROM articles
      WHERE user_id = ${user.id}::uuid
        AND deleted_at IS NULL
        AND content ILIKE ${`%${query}%`}
      LIMIT 20
    `
    const test5Duration = performance.now() - test5Start

    results.tests.push({
      name: 'Articles - content 字段搜索',
      query: `content ILIKE '%${query}%'`,
      resultCount: Array.isArray(articles2) ? articles2.length : 0,
      duration: `${test5Duration.toFixed(2)}ms`,
    })

    // ============================================
    // 测试 6: 使用 Prisma API（对比测试）
    // ============================================
    const test6Start = performance.now()
    const conceptsPrisma = await prisma.concept.findMany({
      where: {
        userId: user.id,
        deletedAt: null,
        OR: [
          { term: { contains: query, mode: 'insensitive' } },
          { myDefinition: { contains: query, mode: 'insensitive' } },
          { myExample: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 20,
      select: {
        id: true,
        term: true,
        myDefinition: true,
      },
    })
    const test6Duration = performance.now() - test6Start

    results.tests.push({
      name: 'Prisma API - Concepts 多字段搜索',
      query: `Prisma contains: ${query}`,
      resultCount: conceptsPrisma.length,
      duration: `${test6Duration.toFixed(2)}ms`,
    })

    // 计算统计数据
    const durations = results.tests.map((t: { duration: string }) => parseFloat(t.duration))
    results.summary = {
      totalTests: results.tests.length,
      averageDuration: `${(durations.reduce((a: number, b: number) => a + b, 0) / durations.length).toFixed(2)}ms`,
      minDuration: `${Math.min(...durations).toFixed(2)}ms`,
      maxDuration: `${Math.max(...durations).toFixed(2)}ms`,
      totalDuration: `${durations.reduce((a: number, b: number) => a + b, 0).toFixed(2)}ms`,
    }

    // 性能评估
    const avgDuration = durations.reduce((a: number, b: number) => a + b, 0) / durations.length
    if (avgDuration < 50) {
      results.summary.performance = '🚀 优秀 - pg_trgm 索引工作正常'
    } else if (avgDuration < 200) {
      results.summary.performance = '✅ 良好 - 索引有效'
    } else if (avgDuration < 500) {
      results.summary.performance = '⚠️ 一般 - 建议检查索引是否创建'
    } else {
      results.summary.performance = '❌ 较慢 - 索引可能未生效，请检查'
    }

    results.summary.recommendations = generateRecommendations(avgDuration)

    return NextResponse.json(results)
  } catch (error: any) {
    console.error('Performance test error:', error)
    return NextResponse.json(
      { error: error.message || 'Test failed' },
      { status: 500 }
    )
  }
}

// 生成优化建议
function generateRecommendations(avgDuration: number): string[] {
  const recommendations: string[] = []

  if (avgDuration > 200) {
    recommendations.push('搜索性能较慢，请确认已在 Supabase SQL Editor 中执行 prisma/add-pg-trgm-indexes.sql')
    recommendations.push('检查索引是否创建成功：SELECT * FROM pg_indexes WHERE indexname LIKE \'%trgm%\'')
  }

  if (avgDuration < 100) {
    recommendations.push('✅ pg_trgm 索引工作良好！')
    recommendations.push('可以考虑进一步优化：')
    recommendations.push('- 使用 PostgreSQL tsvector 进行更精确的全文搜索')
    recommendations.push('- 添加查询结果缓存（已通过 React Query 实现）')
  }

  recommendations.push('对比参考：')
  recommendations.push('- 无索引：通常 500-2000ms')
  recommendations.push('- 有 pg_trgm 索引：通常 10-100ms')
  recommendations.push('- 数据量越大，索引优势越明显')

  return recommendations
}
