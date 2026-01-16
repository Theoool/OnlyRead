-- Migration: Fix Book/Collection Schema
-- Date: 2025-01-16
-- Priority: CRITICAL
-- Description: 修复Article与Collection的关系，添加约束和索引

-- ============================================
-- Step 1: 修复Article表
-- ============================================

-- 1.1 添加外键约束（如果不存在）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'articles_collection_fkey'
    ) THEN
        ALTER TABLE articles
        ADD CONSTRAINT articles_collection_fkey
        FOREIGN KEY (collection_id) REFERENCES collections(id)
        ON DELETE CASCADE;
    END IF;
END $$;

-- 1.2 添加唯一约束：同一Collection的order不能重复
DROP INDEX IF EXISTS articles_collection_order_idx;
CREATE UNIQUE INDEX articles_collection_order_idx
ON articles(collection_id, "order")
WHERE collection_id IS NOT NULL AND "order" IS NOT NULL;

-- 1.3 添加缺失的索引
CREATE INDEX IF NOT EXISTS idx_articles_progress
ON articles(user_id, progress)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_articles_collection_user
ON articles(user_id, collection_id)
WHERE collection_id IS NOT NULL AND deleted_at IS NULL;

-- ============================================
-- Step 2: 增强Collection表
-- ============================================

-- 2.1 添加Book元数据字段
ALTER TABLE collections
ADD COLUMN IF NOT EXISTS author VARCHAR(255),
ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'zh-CN',
ADD COLUMN IF NOT EXISTS isbn VARCHAR(50) UNIQUE;

-- 2.2 添加阅读进度聚合字段
ALTER TABLE collections
ADD COLUMN IF NOT EXISTS total_chapters INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS completed_chapters INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS reading_progress FLOAT DEFAULT 0;

-- 2.3 添加统计字段
ALTER TABLE collections
ADD COLUMN IF NOT EXISTS total_words BIGINT,
ADD COLUMN IF NOT EXISTS estimated_read_time INT;  -- minutes

-- 2.4 添加用户偏好字段
ALTER TABLE collections
ADD COLUMN IF NOT EXISTS user_preferences JSONB DEFAULT '{"fontSize": 16, "lineHeight": 1.6, "theme": "light"}';

-- 2.5 添加索引
CREATE INDEX IF NOT EXISTS idx_collections_user_updated
ON collections(user_id, updated_at DESC);

-- ============================================
-- Step 3: 修复Concept表
-- ============================================

-- 3.1 添加外键约束（如果不存在）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'concepts_source_article_fkey'
    ) THEN
        ALTER TABLE concepts
        ADD CONSTRAINT concepts_source_article_fkey
        FOREIGN KEY (source_article_id) REFERENCES articles(id)
        ON DELETE SET NULL;
    END IF;
END $$;

-- 3.2 添加缺失的索引
CREATE INDEX IF NOT EXISTS idx_concepts_source_article
ON concepts(source_article_id)
WHERE deleted_at IS NULL AND source_article_id IS NOT NULL;

-- 3.3 添加全文搜索索引
CREATE INDEX IF NOT EXISTS idx_concepts_term_gin
ON concepts USING gin(to_tsvector('simple', term))
WHERE deleted_at IS NULL;

-- ============================================
-- Step 4: 创建阅读统计表
-- ============================================

CREATE TABLE IF NOT EXISTS reading_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    total_articles INT DEFAULT 0,
    total_reading_time BIGINT DEFAULT 0,  -- seconds
    total_sessions INT DEFAULT 0,
    current_streak INT DEFAULT 0,
    longest_streak INT DEFAULT 0,
    last_read_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_reading_stats_user
ON reading_stats(user_id);

-- ============================================
-- Step 5: 数据修复（清理孤儿数据）
-- ============================================

-- 5.1 删除没有collectionId但order > 0的文章的order值
UPDATE articles
SET "order" = NULL
WHERE collection_id IS NULL AND "order" IS NOT NULL;

-- 5.2 修复同一collection中重复的order值
WITH duplicates AS (
    SELECT
        collection_id,
        "order",
        array_agg(id) AS article_ids,
        COUNT(*) AS cnt
    FROM articles
    WHERE collection_id IS NOT NULL AND "order" IS NOT NULL
    GROUP BY collection_id, "order"
    HAVING COUNT(*) > 1
)
UPDATE articles
SET "order" = (
    SELECT "order" + ROW_NUMBER() OVER (ORDER BY id)
    FROM articles a2
    WHERE a2.collection_id = articles.collection_id
    AND a2."order" <= articles."order"
    AND a2.id <= articles.id
) - 1
WHERE (collection_id, "order") IN (
    SELECT collection_id, "order" FROM duplicates
);

-- 5.3 更新Collection的total_chapters
UPDATE collections c
SET total_chapters = (
    SELECT COUNT(*)
    FROM articles a
    WHERE a.collection_id = c.id AND a.deleted_at IS NULL
);

-- 5.4 更新Collection的completed_chapters
UPDATE collections c
SET completed_chapters = (
    SELECT COUNT(*)
    FROM articles a
    WHERE a.collection_id = c.id
    AND a.progress >= 99
    AND a.deleted_at IS NULL
);

-- 5.5 更新Collection的reading_progress
UPDATE collections c
SET reading_progress = CASE
    WHEN c.total_chapters > 0 THEN
        ROUND((c.completed_chapters::FLOAT / c.total_chapters::FLOAT) * 100, 2)
    ELSE 0
END
WHERE c.total_chapters > 0;

-- ============================================
-- Step 6: 创建触发器（自动更新Collection统计）
-- ============================================

-- 6.1 创建函数：更新Collection章节统计
CREATE OR REPLACE FUNCTION update_collection_chapter_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.collection_id IS NOT NULL THEN
            UPDATE collections
            SET total_chapters = total_chapters + 1
            WHERE id = NEW.collection_id;
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- 检查progress是否变化
        IF OLD.progress < 99 AND NEW.progress >= 99 THEN
            -- 章节完成
            UPDATE collections
            SET completed_chapters = completed_chapters + 1
            WHERE id = NEW.collection_id;
        ELSIF OLD.progress >= 99 AND NEW.progress < 99 THEN
            -- 章节从完成变未完成
            UPDATE collections
            SET completed_chapters = GREATEST(completed_chapters - 1, 0)
            WHERE id = NEW.collection_id;
        END IF;

        -- 更新进度百分比
        UPDATE collections
        SET reading_progress = ROUND(
            (completed_chapters::FLOAT / GREATEST(total_chapters, 1)::FLOAT) * 100, 2
        )
        WHERE id = NEW.collection_id;

        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.collection_id IS NOT NULL THEN
            UPDATE collections
            SET
                total_chapters = GREATEST(total_chapters - 1, 0),
                completed_chapters = GREATEST(
                    completed_chapters - CASE WHEN OLD.progress >= 99 THEN 1 ELSE 0 END,
                    0
                )
            WHERE id = OLD.collection_id;
        END IF;
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 6.2 创建触发器
DROP TRIGGER IF EXISTS trigger_update_collection_stats ON articles;
CREATE TRIGGER trigger_update_collection_stats
AFTER INSERT OR UPDATE OR DELETE ON articles
FOR EACH ROW
EXECUTE FUNCTION update_collection_chapter_stats();

-- ============================================
-- Step 7: 性能优化视图
-- ============================================

-- 7.1 创建文章详情视图（包含Collection信息）
CREATE OR REPLACE VIEW article_details AS
SELECT
    a.id,
    a.title,
    a.content,
    a.type,
    a.progress,
    a.collection_id,
    a."order",
    c.title AS collection_title,
    c.type AS collection_type,
    c.author AS collection_author,
    c.total_chapters,
    a.user_id,
    a.created_at,
    a.updated_at
FROM articles a
LEFT JOIN collections c ON a.collection_id = c.id
WHERE a.deleted_at IS NULL;

-- 7.2 创建Collection进度视图
CREATE OR REPLACE VIEW collection_progress AS
SELECT
    c.id,
    c.title,
    c.type,
    c.total_chapters,
    c.completed_chapters,
    c.reading_progress,
    COUNT(a.id) FILTER (WHERE a.progress > 0 AND a.progress < 99) AS in_progress_chapters,
    COUNT(a.id) FILTER (WHERE a.progress >= 99) AS completed_count,
    ROUND(AVG(a.progress), 2) AS avg_article_progress
FROM collections c
LEFT JOIN articles a ON a.collection_id = c.id AND a.deleted_at IS NULL
GROUP BY c.id, c.title, c.type, c.total_chapters, c.completed_chapters, c.reading_progress;

-- ============================================
-- Step 8: 验证数据完整性
-- ============================================

-- 8.1 检查是否有违反唯一约束的数据
DO $$
DECLARE
    duplicate_count INT;
BEGIN
    SELECT COUNT(*) INTO duplicate_count
    FROM (
        SELECT collection_id, "order", COUNT(*)
        FROM articles
        WHERE collection_id IS NOT NULL AND "order" IS NOT NULL
        GROUP BY collection_id, "order"
        HAVING COUNT(*) > 1
    ) duplicates;

    IF duplicate_count > 0 THEN
        RAISE WARNING '发现 % 条重复的order值，请检查数据', duplicate_count;
    ELSE
        RAISE NOTICE '数据完整性检查通过';
    END IF;
END $$;

-- 8.2 显示迁移结果
SELECT
    'Collections' AS table_name,
    COUNT(*) AS total_count,
    COUNT(CASE WHEN total_chapters > 0 THEN 1 END) AS with_chapters
FROM collections
UNION ALL
SELECT
    'Articles' AS table_name,
    COUNT(*) AS total_count,
    COUNT(CASE WHEN collection_id IS NOT NULL THEN 1 END) AS in_collections
FROM articles
WHERE deleted_at IS NULL;

-- ============================================
-- Rollback Script（回滚用）
-- ============================================

/*
-- 注意：回滚会丢失所有统计更新，仅在必要时使用

-- 删除触发器
DROP TRIGGER IF EXISTS trigger_update_collection_stats ON articles;
DROP FUNCTION IF EXISTS update_collection_chapter_stats();

-- 删除视图
DROP VIEW IF EXISTS collection_progress;
DROP VIEW IF EXISTS article_details;

-- 删除reading_stats表
DROP TABLE IF EXISTS reading_stats;

-- 删除Collection的新字段
ALTER TABLE collections
DROP COLUMN IF EXISTS author,
DROP COLUMN IF EXISTS language,
DROP COLUMN IF EXISTS isbn,
DROP COLUMN IF EXISTS total_chapters,
DROP COLUMN IF EXISTS completed_chapters,
DROP COLUMN IF EXISTS reading_progress,
DROP COLUMN IF EXISTS total_words,
DROP COLUMN IF EXISTS estimated_read_time,
DROP COLUMN IF EXISTS user_preferences;

-- 删除索引
DROP INDEX IF EXISTS idx_concepts_source_article;
DROP INDEX IF EXISTS idx_concepts_term_gin;
DROP INDEX IF EXISTS idx_articles_progress;
DROP INDEX IF EXISTS idx_articles_collection_user;
DROP INDEX IF EXISTS idx_collections_user_updated;
DROP INDEX IF EXISTS articles_collection_order_idx;

-- 删除外键
ALTER TABLE articles DROP CONSTRAINT IF EXISTS articles_collection_fkey;
ALTER TABLE concepts DROP CONSTRAINT IF EXISTS concepts_source_article_fkey;
*/

-- ============================================
-- Migration Complete
-- ============================================

-- 标记迁移完成
DO $$
BEGIN
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'Book Schema Migration Complete!';
    RAISE NOTICE '===========================================';
    RAISE NOTICE '✓ 外键约束已添加';
    RAISE NOTICE '✓ 唯一约束已添加';
    RAISE NOTICE '✓ 索引已创建';
    RAISE NOTICE '✓ Collection字段已增强';
    RAISE NOTICE '✓ 触发器已创建';
    RAISE NOTICE '✓ 视图已创建';
    RAISE NOTICE '===========================================';
END $$;
