-- Migration: Add session management fields
-- Description: Add type, status, mode, lastActivityAt fields and remove messageCount

-- Step 1: Add new columns with defaults
ALTER TABLE learning_sessions 
  ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'LEARNING',
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS mode VARCHAR(20) DEFAULT 'TUTOR',
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP DEFAULT NOW();

-- Step 2: Update existing data
UPDATE learning_sessions 
SET last_activity_at = updated_at
WHERE last_activity_at IS NULL;

-- Step 3: Add new indexes
CREATE INDEX IF NOT EXISTS idx_sessions_user_status_activity 
ON learning_sessions(user_id, status, last_activity_at DESC);

CREATE INDEX IF NOT EXISTS idx_sessions_user_type_status 
ON learning_sessions(user_id, type, status);

-- Step 4: Drop old indexes that are no longer needed
DROP INDEX IF EXISTS learning_sessions_user_id_updated_at_idx;

-- Step 5: Add metadata column to learning_messages
ALTER TABLE learning_messages 
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Step 6: Create enums (if not exists)
DO $$ BEGIN
  CREATE TYPE "SessionType" AS ENUM ('LEARNING', 'COPILOT', 'QA');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "SessionStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'COMPLETED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ModeType" AS ENUM ('QA', 'TUTOR', 'COPILOT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Step 7: Convert columns to use enums (after data migration)
-- Note: Run this after ensuring all data is valid
-- ALTER TABLE learning_sessions ALTER COLUMN type TYPE "SessionType" USING type::"SessionType";
-- ALTER TABLE learning_sessions ALTER COLUMN status TYPE "SessionStatus" USING status::"SessionStatus";
-- ALTER TABLE learning_sessions ALTER COLUMN mode TYPE "ModeType" USING mode::"ModeType";
-- ALTER TABLE learning_messages ALTER COLUMN role TYPE "MessageRole" USING role::"MessageRole";

-- Step 8: Optional - Remove messageCount column (commented out for safety)
-- ALTER TABLE learning_sessions DROP COLUMN IF EXISTS message_count;

-- Verify migration
SELECT 
  COUNT(*) as total_sessions,
  COUNT(CASE WHEN type IS NOT NULL THEN 1 END) as with_type,
  COUNT(CASE WHEN status IS NOT NULL THEN 1 END) as with_status,
  COUNT(CASE WHEN mode IS NOT NULL THEN 1 END) as with_mode,
  COUNT(CASE WHEN last_activity_at IS NOT NULL THEN 1 END) as with_activity
FROM learning_sessions;

