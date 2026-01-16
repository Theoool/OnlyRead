-- Migration: Safe Book Schema Fix
-- Date: 2025-01-16
-- This migration safely fixes the schema without data loss

-- ============================================
-- Step 1: Add Collection columns (safe)
-- ============================================

ALTER TABLE collections
ADD COLUMN IF NOT EXISTS author VARCHAR(255),
ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'zh-CN',
ADD COLUMN IF NOT EXISTS total_chapters INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS completed_chapters INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS reading_progress FLOAT DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_words BIGINT,
ADD COLUMN IF NOT EXISTS estimated_read_time INT,
ADD COLUMN IF NOT EXISTS user_preferences JSONB DEFAULT '{"fontSize": 16, "lineHeight": 1.6, "theme": "light"}';

-- Add index
CREATE INDEX IF NOT EXISTS idx_collections_user_updated
ON collections(user_id, updated_at DESC);

-- ============================================
-- Step 2: Fix Article unique constraint
-- ============================================

-- First, fix any duplicate order values within collections
DO $$
DECLARE
    duplicate_count INT;
BEGIN
    -- Check for duplicates
    SELECT COUNT(*) INTO duplicate_count
    FROM (
        SELECT collection_id, "order", COUNT(*) as cnt
        FROM articles
        WHERE collection_id IS NOT NULL AND "order" IS NOT NULL
        GROUP BY collection_id, "order"
        HAVING COUNT(*) > 1
    ) duplicates;

    IF duplicate_count > 0 THEN
        RAISE NOTICE 'Found % duplicate order values, fixing...', duplicate_count;

        -- Fix duplicates by renumbering
        WITH numbered AS (
            SELECT
                id,
                collection_id,
                "order",
                ROW_NUMBER() OVER (PARTITION BY collection_id ORDER BY id, "order") as new_order
            FROM articles
            WHERE collection_id IS NOT NULL
        )
        UPDATE articles a
        SET "order" = numbered.new_order - 1
        FROM numbered
        WHERE a.id = numbered.id AND a.collection_id = numbered.collection_id;
    END IF;
END $$;

-- Now add the unique constraint
DROP INDEX IF EXISTS articles_collection_order_idx;
CREATE UNIQUE INDEX IF NOT EXISTS articles_collection_order_idx
ON articles(collection_id, "order")
WHERE collection_id IS NOT NULL AND "order" IS NOT NULL;

-- Add progress index
CREATE INDEX IF NOT EXISTS idx_articles_progress
ON articles(user_id, progress)
WHERE deleted_at IS NULL;

-- ============================================
-- Step 3: Fix Concept foreign key (safe)
-- ============================================

-- First, drop invalid sourceArticleId values
UPDATE concepts
SET source_article_id = NULL
WHERE source_article_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM articles WHERE id = concepts.source_article_id
  );

-- Now add the constraint
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

-- ============================================
-- Step 4: Update Collection statistics
-- ============================================

-- Update total_chapters for all collections
UPDATE collections c
SET total_chapters = (
    SELECT COUNT(*)
    FROM articles a
    WHERE a.collection_id = c.id AND a.deleted_at IS NULL
);

-- Update completed_chapters for all collections
UPDATE collections c
SET completed_chapters = (
    SELECT COUNT(*)
    FROM articles a
    WHERE a.collection_id = c.id
    AND a.progress >= 99
    AND a.deleted_at IS NULL
);

-- Update reading_progress for all collections
UPDATE collections c
SET reading_progress = CASE
    WHEN c.total_chapters > 0 THEN
        ROUND(CAST((c.completed_chapters::FLOAT / c.total_chapters::FLOAT) * 100 AS numeric), 2)
    ELSE 0
END
WHERE c.total_chapters > 0;

-- ============================================
-- Step 5: Create trigger for auto-updating collection stats
-- ============================================

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
        -- Check if progress changed
        IF OLD.progress < 99 AND NEW.progress >= 99 THEN
            UPDATE collections
            SET completed_chapters = completed_chapters + 1
            WHERE id = NEW.collection_id;
        ELSIF OLD.progress >= 99 AND NEW.progress < 99 THEN
            UPDATE collections
            SET completed_chapters = GREATEST(completed_chapters - 1, 0)
            WHERE id = NEW.collection_id;
        END IF;

        -- Update progress percentage
        IF NEW.collection_id IS NOT NULL THEN
            UPDATE collections
            SET reading_progress = LEAST(ROUND(
                CAST((completed_chapters::FLOAT / GREATEST(total_chapters, 1)::FLOAT) * 100 AS numeric), 2
            ), 100)
            WHERE id = NEW.collection_id;
        END IF;

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

-- Drop trigger if exists
DROP TRIGGER IF EXISTS trigger_update_collection_stats ON articles;

-- Create trigger
CREATE TRIGGER trigger_update_collection_stats
AFTER INSERT OR UPDATE OR DELETE ON articles
FOR EACH ROW
EXECUTE FUNCTION update_collection_chapter_stats();

-- ============================================
-- Step 6: Verification
-- ============================================

DO $$
DECLARE
    collection_count INT;
    article_count INT;
    concept_count INT;
    orphan_articles INT;
BEGIN
    SELECT COUNT(*) INTO collection_count FROM collections;
    SELECT COUNT(*) INTO article_count FROM articles WHERE deleted_at IS NULL;
    SELECT COUNT(*) INTO concept_count FROM concepts WHERE deleted_at IS NULL;

    -- Check for orphan articles
    SELECT COUNT(*) INTO orphan_articles
    FROM articles a
    LEFT JOIN collections c ON a.collection_id = c.id
    WHERE a.collection_id IS NOT NULL AND c.id IS NULL;

    RAISE NOTICE '===========================================';
    RAISE NOTICE 'Migration Complete!';
    RAISE NOTICE 'Collections: %', collection_count;
    RAISE NOTICE 'Articles: %', article_count;
    RAISE NOTICE 'Concepts: %', concept_count;
    RAISE NOTICE 'Orphan Articles: % (should be 0)', orphan_articles;
    RAISE NOTICE '===========================================';

    IF orphan_articles > 0 THEN
        RAISE WARNING 'Found % orphan articles - cleaning up...', orphan_articles;
        UPDATE articles SET collection_id = NULL WHERE collection_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM collections WHERE id = articles.collection_id);
    END IF;
END $$;
