-- Migration: Rename 'german' column to 'target_word'
-- This makes the schema truly language-agnostic

-- Step 1: Rename the column
ALTER TABLE vocabulary
RENAME COLUMN german TO target_word;

-- Step 2: Update the comment
COMMENT ON COLUMN vocabulary.target_word IS 'The word in the target language being learned';

-- Step 3: Drop old indexes that referenced 'german' and recreate with new name
DROP INDEX IF EXISTS idx_vocabulary_german;
DROP INDEX IF EXISTS idx_vocabulary_language_german;

-- Recreate indexes with new column name
CREATE INDEX idx_vocabulary_target_word ON vocabulary(target_word);
CREATE INDEX idx_vocabulary_language_target_word ON vocabulary(language, target_word);

-- Migration complete - all references to 'german' column are now 'target_word'
