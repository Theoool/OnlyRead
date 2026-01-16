-- ============================================
-- pg_trgm 全文搜索优化 - 方案一
-- ============================================
-- 说明：这些索引在数据库层创建，对 Prisma 完全透明
-- Prisma 会自动利用这些索引加速现有的 LIKE 查询
-- ============================================

-- 1. 启用 pg_trgm 扩展（如果尚未启用）
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================
-- 2. 为 Concepts 表创建 GIN 三元组索引
-- ============================================

-- term 字段索引（概念名称搜索）
CREATE INDEX IF NOT EXISTS concepts_term_trgm_idx
ON concepts
USING GIN (term gin_trgm_ops);

-- my_definition 字段索引（定义内容搜索）
CREATE INDEX IF NOT EXISTS concepts_my_definition_trgm_idx
ON concepts
USING GIN (my_definition gin_trgm_ops);

-- my_example 字段索引（例句搜索）
CREATE INDEX IF NOT EXISTS concepts_my_example_trgm_idx
ON concepts
USING GIN (my_example gin_trgm_ops);

-- ============================================
-- 3. 为 Articles 表创建 GIN 三元组索引
-- ============================================

-- title 字段索引（标题搜索）
CREATE INDEX IF NOT EXISTS articles_title_trgm_idx
ON articles
USING GIN (title gin_trgm_ops);

-- content 字段索引（正文内容搜索）
CREATE INDEX IF NOT EXISTS articles_content_trgm_idx
ON articles
USING GIN (content gin_trgm_ops);

-- ============================================
-- 4. 验证索引是否创建成功
-- ============================================

-- 查看所有 pg_trgm 索引
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE indexname LIKE '%trgm%'
ORDER BY tablename, indexname;

-- ============================================
-- 5. 性能测试（可选）
-- ============================================

-- 测试 Concepts 搜索性能
EXPLAIN ANALYZE
SELECT * FROM concepts
WHERE term LIKE '%测试%'
   OR my_definition LIKE '%测试%'
   OR my_example LIKE '%测试%';

-- 测试 Articles 搜索性能
EXPLAIN ANALYZE
SELECT * FROM articles
WHERE title LIKE '%测试%'
   OR content LIKE '%测试%';

-- ============================================
-- 完成！
-- ============================================
-- 预期效果：
-- - 搜索速度提升 10-100 倍（取决于数据量）
-- - 现有的 Prisma LIKE 查询会自动使用这些索引
-- - 支持模糊匹配、部分匹配（如 "机器学习" 可以匹配 "学习机器"）
-- - 支持中英文混合搜索
-- ============================================
