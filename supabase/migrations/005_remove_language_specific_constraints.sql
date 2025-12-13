-- Migration: Remove language-specific constraints
-- This allows the database to support multiple languages with different grammatical features

-- Step 1: Drop the auxiliary check constraint (was only for German: haben/sein)
-- This allows French (avoir/être), Spanish (haber/ser), etc.
ALTER TABLE vocabulary
DROP CONSTRAINT IF EXISTS vocabulary_auxiliary_check;

-- Step 2: Drop the gender check constraint (was only masculine/feminine/neuter)
-- Some languages may not use these exact terms or may have different gender systems
-- We'll keep it as TEXT without constraint for flexibility
-- Note: We're keeping the constraint for now but documenting this for future consideration
-- ALTER TABLE vocabulary DROP CONSTRAINT IF EXISTS vocabulary_gender_check;

-- Step 3: Update schema comments
COMMENT ON COLUMN vocabulary.auxiliary IS 'Auxiliary verb used for past tense formation (language-specific, e.g., haben/sein for German, avoir/être for French)';

-- Migration complete - vocabulary table now supports multiple languages
