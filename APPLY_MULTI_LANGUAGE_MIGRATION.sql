-- ================================================
-- Multi-Language Support Migration
-- ================================================
-- This migration adds support for multiple languages to your vocabulary app.
-- Apply this to your Supabase database via the SQL Editor.

-- Step 1: Add language column to vocabulary table
ALTER TABLE vocabulary
ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'german'
CHECK (language IN ('german', 'french', 'spanish', 'italian', 'portuguese', 'dutch', 'swedish', 'danish', 'norwegian'));

-- Step 2: Update existing vocabulary entries to have 'german' as their language
UPDATE vocabulary SET language = 'german' WHERE language IS NULL OR language = 'german';

-- Step 3: Add comment explaining the column
COMMENT ON COLUMN vocabulary.language IS 'The target language being learned (e.g., german, french, spanish)';

-- Step 4: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_vocabulary_language ON vocabulary(language);
CREATE INDEX IF NOT EXISTS idx_vocabulary_language_german ON vocabulary(language, german);
CREATE INDEX IF NOT EXISTS idx_vocabulary_language_type ON vocabulary(language, type);
CREATE INDEX IF NOT EXISTS idx_vocabulary_language_difficulty ON vocabulary(language, difficulty);

-- Step 5: Add target_language preference to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS target_language TEXT DEFAULT 'german'
CHECK (target_language IN ('german', 'french', 'spanish', 'italian', 'portuguese', 'dutch', 'swedish', 'danish', 'norwegian'));

-- Step 6: Set default for existing users
UPDATE profiles SET target_language = 'german' WHERE target_language IS NULL;

-- Step 7: Make target_language NOT NULL after setting defaults
ALTER TABLE profiles ALTER COLUMN target_language SET NOT NULL;

-- Step 8: Add comment
COMMENT ON COLUMN profiles.target_language IS 'The language the user is currently learning';

-- ================================================
-- Migration Complete
-- ================================================
-- You can now:
-- 1. Select your target language in the Profile settings
-- 2. Add vocabulary in different languages
-- 3. Each user's vocabulary will be filtered by their selected language
-- ================================================
