-- ================================================
-- COMPLETE Multi-Language Migration
-- ================================================
-- Apply this single file to enable full multi-language support
-- Includes: language column, target_word rename, and constraint fixes

-- ================================================
-- STEP 1: Add multi-language support
-- ================================================

-- Add language column to vocabulary table
ALTER TABLE vocabulary
ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'german'
CHECK (language IN ('german', 'french', 'spanish', 'italian', 'portuguese', 'dutch', 'swedish', 'danish', 'norwegian'));

-- Update existing vocabulary entries to have 'german' as their language
UPDATE vocabulary SET language = 'german' WHERE language IS NULL OR language = 'german';

-- Add comment explaining the column
COMMENT ON COLUMN vocabulary.language IS 'The target language being learned (e.g., german, french, spanish)';

-- ================================================
-- STEP 2: Add target language to profiles
-- ================================================

-- Add target_language preference to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS target_language TEXT DEFAULT 'german'
CHECK (target_language IN ('german', 'french', 'spanish', 'italian', 'portuguese', 'dutch', 'swedish', 'danish', 'norwegian'));

-- Set default for existing users
UPDATE profiles SET target_language = 'german' WHERE target_language IS NULL;

-- Make target_language NOT NULL after setting defaults
ALTER TABLE profiles ALTER COLUMN target_language SET NOT NULL;

-- Add comment
COMMENT ON COLUMN profiles.target_language IS 'The language the user is currently learning';

-- ================================================
-- STEP 3: Rename 'german' column to 'target_word'
-- ================================================

-- Rename the column
ALTER TABLE vocabulary
RENAME COLUMN german TO target_word;

-- Update the comment
COMMENT ON COLUMN vocabulary.target_word IS 'The word in the target language being learned';

-- ================================================
-- STEP 4: Remove language-specific constraints
-- ================================================

-- Remove auxiliary verb constraint (was only for German: haben/sein)
ALTER TABLE vocabulary
DROP CONSTRAINT IF EXISTS vocabulary_auxiliary_check;

-- Add comment explaining the field
COMMENT ON COLUMN vocabulary.auxiliary IS 'Auxiliary verb used for past tense formation (language-specific, e.g., haben/sein for German, avoir/être for French)';

-- ================================================
-- STEP 5: Update indexes for performance
-- ================================================

-- Drop old indexes
DROP INDEX IF EXISTS idx_vocabulary_german;
DROP INDEX IF EXISTS idx_vocabulary_language_german;

-- Create new indexes with updated column names
CREATE INDEX IF NOT EXISTS idx_vocabulary_language ON vocabulary(language);
CREATE INDEX IF NOT EXISTS idx_vocabulary_target_word ON vocabulary(target_word);
CREATE INDEX IF NOT EXISTS idx_vocabulary_language_target_word ON vocabulary(language, target_word);
CREATE INDEX IF NOT EXISTS idx_vocabulary_language_type ON vocabulary(language, type);
CREATE INDEX IF NOT EXISTS idx_vocabulary_language_difficulty ON vocabulary(language, difficulty);

-- ================================================
-- Migration Complete!
-- ================================================
-- Your app now supports multiple languages:
-- ✅ Users can select their target language in Profile
-- ✅ Vocabulary is filtered by language
-- ✅ Database schema is language-agnostic
-- ✅ No more constraint errors when adding non-German words
-- ================================================
