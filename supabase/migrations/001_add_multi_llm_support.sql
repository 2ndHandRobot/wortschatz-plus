-- Migration: Add multi-LLM support
-- This migration adds support for multiple LLM providers (Claude, Gemini, ChatGPT, DeepSeek)

-- Add new columns to profiles table for selected LLM provider
ALTER TABLE profiles
  ADD COLUMN selected_llm_provider TEXT DEFAULT 'anthropic' CHECK (selected_llm_provider IN ('anthropic', 'google', 'openai', 'deepseek'));

-- Rename claude_api_key to anthropic_api_key for consistency
ALTER TABLE profiles
  RENAME COLUMN claude_api_key TO anthropic_api_key;

-- Add API key columns for other providers
ALTER TABLE profiles
  ADD COLUMN google_api_key TEXT, -- for Gemini
  ADD COLUMN openai_api_key TEXT, -- for ChatGPT
  ADD COLUMN deepseek_api_key TEXT; -- for DeepSeek

-- Add comments for clarity
COMMENT ON COLUMN profiles.selected_llm_provider IS 'The LLM provider selected by the user for AI-powered features';
COMMENT ON COLUMN profiles.anthropic_api_key IS 'API key for Anthropic (Claude) - encrypted in production';
COMMENT ON COLUMN profiles.google_api_key IS 'API key for Google (Gemini) - encrypted in production';
COMMENT ON COLUMN profiles.openai_api_key IS 'API key for OpenAI (ChatGPT) - encrypted in production';
COMMENT ON COLUMN profiles.deepseek_api_key IS 'API key for DeepSeek - encrypted in production';
