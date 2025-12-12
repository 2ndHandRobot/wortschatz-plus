-- Fix RLS policies for vocabulary table
-- The vocabulary table should allow authenticated users to INSERT new words
-- This enables users to add words discovered via LLM lookup to the shared dictionary

-- Enable RLS on vocabulary if not already enabled
ALTER TABLE vocabulary ENABLE ROW LEVEL SECURITY;

-- Drop existing vocabulary policies
DROP POLICY IF EXISTS "Authenticated users can view vocabulary" ON vocabulary;

-- Recreate with additional INSERT policy
-- SELECT: All authenticated users can read vocabulary
CREATE POLICY "Authenticated users can view vocabulary" ON vocabulary
  FOR SELECT USING (auth.role() = 'authenticated');

-- INSERT: All authenticated users can add new words to the shared dictionary
CREATE POLICY "Authenticated users can insert vocabulary" ON vocabulary
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Optional: Allow authenticated users to update vocabulary entries they use
-- Uncomment the following if you want collaborative editing
-- CREATE POLICY "Authenticated users can update vocabulary" ON vocabulary
--   FOR UPDATE USING (auth.role() = 'authenticated');

-- Note: We intentionally do NOT allow DELETE to prevent accidental data loss
-- Only database admins can delete vocabulary entries
