-- Change embedding column type from vector(1024) to vector(1536) in articles table
-- Note: This will fail if there is existing data in the column that doesn't match the dimension.
-- Since this is a dev environment, we can drop and recreate the column if needed, 
-- but ideally we just alter it if it's empty or we are okay with truncating.

-- Option 1: If you don't care about existing embeddings in articles (safest for dev)
ALTER TABLE articles DROP COLUMN IF EXISTS embedding;
ALTER TABLE articles ADD COLUMN embedding vector(1536);

-- Option 2: If you want to try to alter (will fail if data exists)
-- ALTER TABLE articles ALTER COLUMN embedding TYPE vector(1536);

-- Recreate index for the new dimension
DROP INDEX IF EXISTS articles_embedding_idx;
CREATE INDEX IF NOT EXISTS articles_embedding_idx ON articles USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
