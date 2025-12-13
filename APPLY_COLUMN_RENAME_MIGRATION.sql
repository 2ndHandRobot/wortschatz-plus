-- ================================================
-- Rename 'german' column to 'target_word'
-- ================================================
-- This migration makes the database schema truly language-agnostic
-- by renaming the 'german' column to 'target_word'

-- Step 1: Rename the column
ALTER TABLE vocabulary
RENAME COLUMN german TO target_word;

-- Step 2: Update the comment
COMMENT ON COLUMN vocabulary.target_word IS 'The word in the target language being learned';

-- Step 3: Drop old indexes that referenced 'german' and recreate with new name
DROP INDEX IF EXISTS idx_vocabulary_german;
DROP INDEX IF EXISTS idx_vocabulary_language_german;

-- Step 4: Recreate indexes with new column name
CREATE INDEX idx_vocabulary_target_word ON vocabulary(target_word);
CREATE INDEX idx_vocabulary_language_target_word ON vocabulary(language, target_word);

-- ================================================
-- Migration Complete
-- ================================================
-- The 'german' column is now 'target_word'
-- All code has been updated to use the new field name
-- Backward compatibility is maintained in TypeScript types
-- ================================================
