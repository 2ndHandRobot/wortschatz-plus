-- ================================================
-- Fix: Remove Language-Specific Constraints
-- ================================================
-- This fixes the error when adding non-German vocabulary
-- by removing constraints that were specific to German grammar

-- Remove the auxiliary verb constraint
-- Was: CHECK (auxiliary IN ('haben', 'sein'))
-- Now: Accepts any auxiliary verb (avoir/être for French, haber/ser for Spanish, etc.)
ALTER TABLE vocabulary
DROP CONSTRAINT IF EXISTS vocabulary_auxiliary_check;

-- Add comment explaining the field
COMMENT ON COLUMN vocabulary.auxiliary IS 'Auxiliary verb used for past tense formation (language-specific, e.g., haben/sein for German, avoir/être for French)';

-- ================================================
-- Migration Complete
-- ================================================
-- You can now add vocabulary in any language without constraint errors
-- ================================================
