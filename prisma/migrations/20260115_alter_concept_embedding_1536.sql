-- Change concepts table embedding column from vector(1024) to vector(1536)
-- This aligns with the schema.prisma definition and text-embedding-v2 model

-- Step 1: Drop existing embeddings (will be regenerated)
ALTER TABLE concepts DROP COLUMN IF EXISTS embedding;

-- Step 2: Add embedding column with 1536 dimensions
ALTER TABLE concepts ADD COLUMN embedding vector(1536);

-- Step 3: Recreate index for the new dimension
DROP INDEX IF EXISTS concepts_embedding_idx;
CREATE INDEX concepts_embedding_idx ON concepts USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Step 4: Add comment for documentation
COMMENT ON COLUMN concepts.embedding IS 'Vector embedding for semantic search (1536 dimensions for text-embedding-v2)';
