-- Migration: Add model selection support for each LLM provider

-- Add columns for model selection
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS anthropic_model TEXT DEFAULT 'claude-haiku-4-5-20251001',
  ADD COLUMN IF NOT EXISTS google_model TEXT DEFAULT 'gemini-1.5-flash-latest',
  ADD COLUMN IF NOT EXISTS openai_model TEXT DEFAULT 'gpt-4o-mini',
  ADD COLUMN IF NOT EXISTS deepseek_model TEXT DEFAULT 'deepseek-chat';

-- Add comments for clarity
COMMENT ON COLUMN profiles.anthropic_model IS 'Selected Anthropic (Claude) model';
COMMENT ON COLUMN profiles.google_model IS 'Selected Google (Gemini) model';
COMMENT ON COLUMN profiles.openai_model IS 'Selected OpenAI (ChatGPT) model';
COMMENT ON COLUMN profiles.deepseek_model IS 'Selected DeepSeek model';
