-- Migration: Add shareable word lists
-- Allows users to create word lists and share them via unique codes

-- Word lists table
CREATE TABLE word_lists (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  share_code TEXT UNIQUE, -- unique code for sharing (e.g., 'abc123xyz')
  language TEXT NOT NULL CHECK (language IN ('german', 'french', 'spanish', 'italian', 'portuguese', 'dutch', 'swedish', 'danish', 'norwegian')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Many-to-many relationship between lists and vocabulary words
CREATE TABLE word_list_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  list_id UUID REFERENCES word_lists(id) ON DELETE CASCADE NOT NULL,
  vocabulary_id TEXT REFERENCES vocabulary(id) ON DELETE CASCADE NOT NULL,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  added_by UUID REFERENCES profiles(id) ON DELETE SET NULL, -- who added this word to the list

  -- Prevent duplicate words in same list
  UNIQUE(list_id, vocabulary_id)
);

-- Access control for shared lists (for future collaborative features)
CREATE TABLE word_list_access (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  list_id UUID REFERENCES word_lists(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  access_type TEXT NOT NULL CHECK (access_type IN ('owner', 'collaborator', 'viewer')),
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- User can have only one access type per list
  UNIQUE(list_id, user_id)
);

-- Indexes for performance
CREATE INDEX idx_word_lists_user_id ON word_lists(user_id);
CREATE INDEX idx_word_lists_share_code ON word_lists(share_code);
CREATE INDEX idx_word_lists_is_public ON word_lists(is_public);
CREATE INDEX idx_word_lists_language ON word_lists(language);
CREATE INDEX idx_word_list_items_list_id ON word_list_items(list_id);
CREATE INDEX idx_word_list_items_vocabulary_id ON word_list_items(vocabulary_id);
CREATE INDEX idx_word_list_access_list_id ON word_list_access(list_id);
CREATE INDEX idx_word_list_access_user_id ON word_list_access(user_id);

-- Enable Row Level Security
ALTER TABLE word_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE word_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE word_list_access ENABLE ROW LEVEL SECURITY;

-- RLS Policies for word_lists
-- Users can view their own lists
CREATE POLICY "Users can view own lists" ON word_lists
  FOR SELECT USING (auth.uid() = user_id);

-- Users can view public lists (via share code)
CREATE POLICY "Anyone can view public lists" ON word_lists
  FOR SELECT USING (is_public = TRUE);

-- Users can insert their own lists
CREATE POLICY "Users can insert own lists" ON word_lists
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own lists
CREATE POLICY "Users can update own lists" ON word_lists
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own lists
CREATE POLICY "Users can delete own lists" ON word_lists
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for word_list_items
-- Users can view items in their own lists or public lists
CREATE POLICY "Users can view items in accessible lists" ON word_list_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM word_lists
      WHERE word_lists.id = word_list_items.list_id
      AND (word_lists.user_id = auth.uid() OR word_lists.is_public = TRUE)
    )
  );

-- Users can insert items into their own lists
CREATE POLICY "Users can insert items into own lists" ON word_list_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM word_lists
      WHERE word_lists.id = word_list_items.list_id
      AND word_lists.user_id = auth.uid()
    )
  );

-- Users can delete items from their own lists
CREATE POLICY "Users can delete items from own lists" ON word_list_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM word_lists
      WHERE word_lists.id = word_list_items.list_id
      AND word_lists.user_id = auth.uid()
    )
  );

-- RLS Policies for word_list_access
-- Users can view access records for lists they own
CREATE POLICY "Users can view access for own lists" ON word_list_access
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM word_lists
      WHERE word_lists.id = word_list_access.list_id
      AND word_lists.user_id = auth.uid()
    )
  );

-- Users can insert access records for their own lists
CREATE POLICY "Users can grant access to own lists" ON word_list_access
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM word_lists
      WHERE word_lists.id = word_list_access.list_id
      AND word_lists.user_id = auth.uid()
    )
  );

-- Users can delete access records for their own lists
CREATE POLICY "Users can revoke access to own lists" ON word_list_access
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM word_lists
      WHERE word_lists.id = word_list_access.list_id
      AND word_lists.user_id = auth.uid()
    )
  );

-- Trigger for automatic timestamp updates
CREATE TRIGGER update_word_lists_updated_at BEFORE UPDATE ON word_lists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate unique share code
CREATE OR REPLACE FUNCTION generate_share_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  code TEXT := '';
  i INTEGER;
BEGIN
  -- Generate 10-character code
  FOR i IN 1..10 LOOP
    code := code || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql;
