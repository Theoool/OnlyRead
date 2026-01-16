import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

/**
 * 搜索索引诊断工具
 *
 * 用于诊断 pg_trgm 索引问题
 */
export async function GET() {
  try {
    const diagnostics: any = {
      timestamp: new Date().toISOString(),
      checks: [],
      issues: [],
      recommendations: [],
    }

    // ============================================
    // 检查 1: pg_trgm 扩展是否安装
    // ============================================
    const extensionCheck: any = await prisma.$queryRaw`
      SELECT * FROM pg_extension WHERE extname = 'pg_trgm'
    `

    const hasExtension = Array.isArray(extensionCheck) && extensionCheck.length > 0

    diagnostics.checks.push({
      name: 'pg_trgm 扩展',
      status: hasExtension ? '✅ 已安装' : '❌ 未安装',
      details: hasExtension ? extensionCheck[0] : null,
    })

    if (!hasExtension) {
      diagnostics.issues.push('pg_trgm 扩展未安装')
      diagnostics.recommendations.push('在 Supabase SQL Editor 中运行: CREATE EXTENSION IF NOT EXISTS pg_trgm;')
    }

    // ============================================
    // 检查 2: 索引是否存在
    // ============================================
    const indexCheck: any = await prisma.$queryRaw`
      SELECT
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE indexname LIKE '%trgm%'
      ORDER BY tablename, indexname
    `

    const expectedIndexes = [
      'concepts_term_trgm_idx',
      'concepts_my_definition_trgm_idx',
      'concepts_my_example_trgm_idx',
      'articles_title_trgm_idx',
      'articles_content_trgm_idx',
    ]

    const existingIndexes = Array.isArray(indexCheck) ? indexCheck.map((i: any) => i.indexname) : []
    const missingIndexes = expectedIndexes.filter(idx => !existingIndexes.includes(idx))

    diagnostics.checks.push({
      name: 'pg_trgm 索引',
      status: missingIndexes.length === 0 ? '✅ 全部创建' : `❌ 缺少 ${missingIndexes.length} 个`,
      expected: expectedIndexes,
      existing: existingIndexes,
      missing: missingIndexes,
    })

    if (missingIndexes.length > 0) {
      diagnostics.issues.push(`缺少 ${missingIndexes.length} 个索引: ${missingIndexes.join(', ')}`)
      diagnostics.recommendations.push('在 Supabase SQL Editor 中执行 prisma/add-pg-trgm-indexes.sql')
    }

    // ============================================
    // 检查 3: 表行数统计
    // ============================================
    const tableStats: any = await prisma.$queryRaw`
      SELECT
        COUNT(*) as concept_count
      FROM concepts
    `
    const articleStats: any = await prisma.$queryRaw`
      SELECT
        COUNT(*) as article_count
      FROM articles
    `

    diagnostics.checks.push({
      name: '数据表统计',
      status: 'ℹ️ 信息',
      conceptCount: tableStats?.[0]?.concept_count || 0,
      articleCount: articleStats?.[0]?.article_count || 0,
    })

    // ============================================
    // 检查 4: 查询执行计划 (EXPLAIN)
    // ============================================
    const testQuery = '新加坡'

    // 测试 Concepts 查询计划
    let conceptPlan: any
    try {
      conceptPlan = await prisma.$queryRawUnsafe(`
        EXPLAIN (FORMAT JSON)
        SELECT id, term, my_definition
        FROM concepts
        WHERE term ILIKE '%${testQuery}%'
        LIMIT 20
      `)
    } catch (e) {
      conceptPlan = { error: String(e) }
    }

    // 测试 Articles 查询计划
    let articlePlan: any
    try {
      articlePlan = await prisma.$queryRawUnsafe(`
        EXPLAIN (FORMAT JSON)
        SELECT id, title, content
        FROM articles
        WHERE title ILIKE '%${testQuery}%'
        LIMIT 20
      `)
    } catch (e) {
      articlePlan = { error: String(e) }
    }

    diagnostics.checks.push({
      name: '查询执行计划',
      status: 'ℹ️ 信息',
      conceptPlan,
      articlePlan,
    })

    // 分析执行计划
    const analyzePlan = (plan: any, tableName: string) => {
      if (!plan || plan.error) return { status: '❌ 无法获取', reason: plan.error }

      const planStr = JSON.stringify(plan)
      const usesIndex = planStr.includes('Index Scan') || planStr.includes('Bitmap Index Scan')
      const usesSeqScan = planStr.includes('Seq Scan')

      if (usesIndex) {
        return { status: '✅ 使用索引', method: 'Index Scan' }
      } else if (usesSeqScan) {
        return { status: '⚠️ 全表扫描', method: 'Seq Scan', reason: '索引未生效' }
      } else {
        return { status: '❓ 无法判断', reason: '未找到明确标识' }
      }
    }

    const conceptAnalysis = analyzePlan(conceptPlan, 'concepts')
    const articleAnalysis = analyzePlan(articlePlan, 'articles')

    diagnostics.queryAnalysis = {
      concepts: conceptAnalysis,
      articles: articleAnalysis,
    }

    if (conceptAnalysis.status === '⚠️ 全表扫描' || articleAnalysis.status === '⚠️ 全表扫描') {
      diagnostics.issues.push('查询未使用索引，进行全表扫描')
      diagnostics.recommendations.push('检查索引是否正确创建在相应字段上')
    }

    // ============================================
    // 检查 5: 索引大小统计
    // ============================================
    const indexSizes: any = await prisma.$queryRaw`
      SELECT
        indexname,
        pg_size_pretty(pg_relation_size(indexname::text)) AS size
      FROM pg_indexes
      WHERE indexname LIKE '%trgm%'
      ORDER BY pg_relation_size(indexname::text) DESC
    `

    diagnostics.checks.push({
      name: '索引大小',
      status: 'ℹ️ 信息',
      indexes: indexSizes,
    })

    // ============================================
    // 检查 6: 数据库版本
    // ============================================
    const version: any = await prisma.$queryRaw`SELECT version()`

    diagnostics.checks.push({
      name: 'PostgreSQL 版本',
      status: 'ℹ️ 信息',
      version: version,
    })

    // ============================================
    // 总体评估
    // ============================================
    const criticalIssues = diagnostics.issues.filter((i: string) => i.includes('未安装') || i.includes('全表扫描'))

    if (criticalIssues.length > 0) {
      diagnostics.overall = '❌ 存在严重问题'
      diagnostics.recommendations.push('⚠️ 搜索性能受到严重影响，请立即处理上述问题')
    } else if (missingIndexes.length > 0) {
      diagnostics.overall = '⚠️ 部分配置缺失'
      diagnostics.recommendations.push('请补充缺失的索引以获得最佳性能')
    } else {
      diagnostics.overall = '✅ 配置正确'
      diagnostics.recommendations.push('所有配置正确，但性能仍然较慢，可能需要检查网络延迟或数据量')
    }

    // ============================================
    // 生成修复 SQL
    // ============================================
    if (!hasExtension || missingIndexes.length > 0) {
      diagnostics.fixSQL = []

      if (!hasExtension) {
        diagnostics.fixSQL.push('-- 启用 pg_trgm 扩展')
        diagnostics.fixSQL.push('CREATE EXTENSION IF NOT EXISTS pg_trgm;')
        diagnostics.fixSQL.push('')
      }

      if (missingIndexes.includes('concepts_term_trgm_idx')) {
        diagnostics.fixSQL.push('-- Concepts term 索引')
        diagnostics.fixSQL.push('DROP INDEX IF EXISTS concepts_term_trgm_idx;')
        diagnostics.fixSQL.push('CREATE INDEX concepts_term_trgm_idx ON concepts USING GIN (term gin_trgm_ops);')
        diagnostics.fixSQL.push('')
      }

      if (missingIndexes.includes('concepts_my_definition_trgm_idx')) {
        diagnostics.fixSQL.push('-- Concepts my_definition 索引')
        diagnostics.fixSQL.push('DROP INDEX IF EXISTS concepts_my_definition_trgm_idx;')
        diagnostics.fixSQL.push('CREATE INDEX concepts_my_definition_trgm_idx ON concepts USING GIN (my_definition gin_trgm_ops);')
        diagnostics.fixSQL.push('')
      }

      if (missingIndexes.includes('concepts_my_example_trgm_idx')) {
        diagnostics.fixSQL.push('-- Concepts my_example 索引')
        diagnostics.fixSQL.push('DROP INDEX IF EXISTS concepts_my_example_trgm_idx;')
        diagnostics.fixSQL.push('CREATE INDEX concepts_my_example_trgm_idx ON concepts USING GIN (my_example gin_trgm_ops);')
        diagnostics.fixSQL.push('')
      }

      if (missingIndexes.includes('articles_title_trgm_idx')) {
        diagnostics.fixSQL.push('-- Articles title 索引')
        diagnostics.fixSQL.push('DROP INDEX IF EXISTS articles_title_trgm_idx;')
        diagnostics.fixSQL.push('CREATE INDEX articles_title_trgm_idx ON articles USING GIN (title gin_trgm_ops);')
        diagnostics.fixSQL.push('')
      }

      if (missingIndexes.includes('articles_content_trgm_idx')) {
        diagnostics.fixSQL.push('-- Articles content 索引')
        diagnostics.fixSQL.push('DROP INDEX IF EXISTS articles_content_trgm_idx;')
        diagnostics.fixSQL.push('CREATE INDEX articles_content_trgm_idx ON articles USING GIN (content gin_trgm_ops);')
        diagnostics.fixSQL.push('')
      }
    }

    return NextResponse.json(diagnostics)
  } catch (error: any) {
    console.error('Diagnostics error:', error)
    return NextResponse.json(
      {
        error: error.message,
        stack: error.stack,
        hint: '请确保数据库连接正常',
      },
      { status: 500 }
    )
  }
}
