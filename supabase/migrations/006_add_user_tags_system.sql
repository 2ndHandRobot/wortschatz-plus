-- Migration: Add user tags system
-- Allows users to create custom tags and apply them to their words

-- User-created tags table
CREATE TABLE user_tags (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  category TEXT CHECK (category IN ('thematic', 'situational', 'custom')),
  color TEXT, -- hex color for UI (e.g., '#3B82F6')
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure unique tag names per user
  UNIQUE(user_id, name)
);

-- Many-to-many relationship between user words and tags
CREATE TABLE word_tags (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_word_id UUID REFERENCES user_words(id) ON DELETE CASCADE NOT NULL,
  tag_id UUID REFERENCES user_tags(id) ON DELETE CASCADE NOT NULL,
  tagged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Prevent duplicate tags on same word
  UNIQUE(user_word_id, tag_id)
);

-- Indexes for performance
CREATE INDEX idx_user_tags_user_id ON user_tags(user_id);
CREATE INDEX idx_user_tags_category ON user_tags(category);
CREATE INDEX idx_word_tags_user_word_id ON word_tags(user_word_id);
CREATE INDEX idx_word_tags_tag_id ON word_tags(tag_id);

-- Enable Row Level Security
ALTER TABLE user_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE word_tags ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_tags
CREATE POLICY "Users can view own tags" ON user_tags
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tags" ON user_tags
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tags" ON user_tags
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tags" ON user_tags
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for word_tags
CREATE POLICY "Users can view own word tags" ON word_tags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_words
      WHERE user_words.id = word_tags.user_word_id
      AND user_words.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own word tags" ON word_tags
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_words
      WHERE user_words.id = word_tags.user_word_id
      AND user_words.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own word tags" ON word_tags
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_words
      WHERE user_words.id = word_tags.user_word_id
      AND user_words.user_id = auth.uid()
    )
  );

-- Trigger for automatic timestamp updates
CREATE TRIGGER update_user_tags_updated_at BEFORE UPDATE ON user_tags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
