-- Enable UPDATE policy for vocabulary table
-- This allows authenticated users to edit vocabulary entries

CREATE POLICY "Authenticated users can update vocabulary" ON vocabulary
  FOR UPDATE USING (auth.role() = 'authenticated');
