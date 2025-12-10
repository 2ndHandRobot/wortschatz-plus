-- ============================================================================
-- COMBINED MIGRATION FOR MULTI-LLM SUPPORT
-- Run this in your Supabase SQL Editor
-- ============================================================================

-- MIGRATION 001: Add multi-LLM provider support
-- ----------------------------------------------------------------------------

-- Add new columns to profiles table for selected LLM provider
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS selected_llm_provider TEXT DEFAULT 'anthropic'
    CHECK (selected_llm_provider IN ('anthropic', 'google', 'openai', 'deepseek'));

-- Rename claude_api_key to anthropic_api_key for consistency
-- Note: Skip this if you've already run migration 001
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'claude_api_key'
  ) THEN
    ALTER TABLE profiles RENAME COLUMN claude_api_key TO anthropic_api_key;
  END IF;
END $$;

-- Add API key columns for other providers
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS anthropic_api_key TEXT,
  ADD COLUMN IF NOT EXISTS google_api_key TEXT,
  ADD COLUMN IF NOT EXISTS openai_api_key TEXT,
  ADD COLUMN IF NOT EXISTS deepseek_api_key TEXT;

-- Add comments for API keys
COMMENT ON COLUMN profiles.selected_llm_provider IS 'The LLM provider selected by the user for AI-powered features';
COMMENT ON COLUMN profiles.anthropic_api_key IS 'API key for Anthropic (Claude) - encrypted in production';
COMMENT ON COLUMN profiles.google_api_key IS 'API key for Google (Gemini) - encrypted in production';
COMMENT ON COLUMN profiles.openai_api_key IS 'API key for OpenAI (ChatGPT) - encrypted in production';
COMMENT ON COLUMN profiles.deepseek_api_key IS 'API key for DeepSeek - encrypted in production';


-- MIGRATION 002: Add model selection support
-- ----------------------------------------------------------------------------

-- Add columns for model selection per provider
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS anthropic_model TEXT DEFAULT 'claude-haiku-4-5-20251001',
  ADD COLUMN IF NOT EXISTS google_model TEXT DEFAULT 'gemini-1.5-flash-latest',
  ADD COLUMN IF NOT EXISTS openai_model TEXT DEFAULT 'gpt-4o-mini',
  ADD COLUMN IF NOT EXISTS deepseek_model TEXT DEFAULT 'deepseek-chat';

-- Add comments for model columns
COMMENT ON COLUMN profiles.anthropic_model IS 'Selected Anthropic (Claude) model';
COMMENT ON COLUMN profiles.google_model IS 'Selected Google (Gemini) model';
COMMENT ON COLUMN profiles.openai_model IS 'Selected OpenAI (ChatGPT) model';
COMMENT ON COLUMN profiles.deepseek_model IS 'Selected DeepSeek model';


-- VERIFICATION: Check that all columns exist
-- ----------------------------------------------------------------------------

SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name IN (
    'selected_llm_provider',
    'anthropic_api_key', 'google_api_key', 'openai_api_key', 'deepseek_api_key',
    'anthropic_model', 'google_model', 'openai_model', 'deepseek_model'
  )
ORDER BY column_name;

-- Expected output: 9 rows showing all the columns above
-- If you see fewer rows, some columns are missing and need to be added
