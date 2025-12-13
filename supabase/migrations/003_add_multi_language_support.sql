-- Migration: Add multi-language support
-- This migration adds language support to the vocabulary app

-- Add language column to vocabulary table
ALTER TABLE vocabulary
ADD COLUMN language TEXT NOT NULL DEFAULT 'german'
CHECK (language IN ('german', 'french', 'spanish', 'italian', 'portuguese', 'dutch', 'swedish', 'danish', 'norwegian'));

-- Rename 'german' column to 'target_word' (more generic for multi-language)
-- But first, update existing data to set language to 'german'
UPDATE vocabulary SET language = 'german' WHERE language IS NULL OR language = 'german';

-- Add comment explaining the column
COMMENT ON COLUMN vocabulary.language IS 'The target language being learned (e.g., german, french, spanish)';

-- Create indexes for performance
CREATE INDEX idx_vocabulary_language ON vocabulary(language);
CREATE INDEX idx_vocabulary_language_german ON vocabulary(language, german);
CREATE INDEX idx_vocabulary_language_type ON vocabulary(language, type);
CREATE INDEX idx_vocabulary_language_difficulty ON vocabulary(language, difficulty);

-- Add target_language preference to profiles table
ALTER TABLE profiles
ADD COLUMN target_language TEXT DEFAULT 'german'
CHECK (target_language IN ('german', 'french', 'spanish', 'italian', 'portuguese', 'dutch', 'swedish', 'danish', 'norwegian'));

-- Set default for existing users
UPDATE profiles SET target_language = 'german' WHERE target_language IS NULL;

-- Make target_language NOT NULL after setting defaults
ALTER TABLE profiles ALTER COLUMN target_language SET NOT NULL;

COMMENT ON COLUMN profiles.target_language IS 'The language the user is currently learning';
