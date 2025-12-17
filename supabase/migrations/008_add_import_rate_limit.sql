-- Migration: Add import rate limit configuration
-- This migration adds a configurable delay for import operations to respect LLM API rate limits

-- Add import_delay_ms column to profiles table
ALTER TABLE profiles
  ADD COLUMN import_delay_ms INTEGER DEFAULT 1500 CHECK (import_delay_ms >= 0 AND import_delay_ms <= 10000);

-- Add comment for clarity
COMMENT ON COLUMN profiles.import_delay_ms IS 'Delay in milliseconds between enrichment requests during bulk imports (default: 1500ms = 40 requests/minute). Adjust based on your LLM provider rate limits.';
