-- Enable the pgvector extension to work with embedding vectors
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to Concept table if it doesn't exist
-- Note: Prisma will manage the schema but sometimes extensions need manual enabling
-- The 'embedding' column is already defined in schema.prisma as Unsupported("vector(1536)")

-- Create an IVFFlat index for fast similarity search
-- Adjust 'lists' based on your data size (rows / 1000 is a good rule of thumb, default 100)
CREATE INDEX IF NOT EXISTS concepts_embedding_idx ON concepts USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
