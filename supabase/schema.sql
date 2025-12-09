-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  target_daily_learning_time INTEGER DEFAULT 15, -- in minutes
  claude_api_key TEXT, -- encrypted in production
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vocabulary words (shared dictionary - all word types)
CREATE TABLE vocabulary (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('noun', 'verb', 'adjective', 'adverb', 'pronoun', 'article', 'preposition', 'conjunction', 'expression', 'collocation')),
  german TEXT NOT NULL,
  english TEXT[] NOT NULL,
  difficulty TEXT CHECK (difficulty IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  tags TEXT[],
  examples JSONB DEFAULT '[]',
  notes TEXT,
  audio_url TEXT,

  -- Noun-specific fields
  article TEXT,
  gender TEXT CHECK (gender IN ('masculine', 'feminine', 'neuter')),
  plural TEXT,
  genitive TEXT,
  weak BOOLEAN,
  compound JSONB,

  -- Verb-specific fields
  infinitive TEXT,
  auxiliary TEXT CHECK (auxiliary IN ('haben', 'sein')),
  separable JSONB,
  reflexive JSONB,
  transitivity TEXT CHECK (transitivity IN ('transitive', 'intransitive', 'both')),
  conjugation JSONB,

  -- Adjective-specific fields
  base TEXT,
  comparative TEXT,
  superlative TEXT,
  irregular BOOLEAN,
  predicative_only BOOLEAN,

  -- Adverb-specific fields
  category TEXT,

  -- Pronoun-specific fields
  pronoun_type TEXT,
  declension JSONB,
  person TEXT,
  number TEXT,

  -- Article-specific fields
  article_type TEXT,

  -- Preposition-specific fields
  governs_case TEXT[],
  two_way BOOLEAN,
  contracted JSONB,

  -- Conjunction-specific fields
  conjunction_type TEXT,
  affects_word_order BOOLEAN,
  correlative_pair TEXT,

  -- Expression-specific fields
  literal TEXT,
  register TEXT,
  expression_category TEXT,
  related_words TEXT[],

  -- Collocation-specific fields
  structure TEXT,
  components JSONB,
  strength TEXT,
  alternative TEXT,

  -- Shared field for preposition/case associations
  preposition_case JSONB, -- array of {preposition, case} objects

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User's personal dictionary entries
CREATE TABLE user_words (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  word_id TEXT REFERENCES vocabulary(id) NOT NULL,

  -- Learning status
  status TEXT DEFAULT 'revising' CHECK (status IN ('revising', 'recalling', 'practicing', 'mastered')),

  -- Priority and scheduling
  priority_score FLOAT DEFAULT 0,
  next_review_date TIMESTAMP WITH TIME ZONE,

  -- Spaced repetition data
  ease_factor FLOAT DEFAULT 2.5,
  interval INTEGER DEFAULT 0, -- days
  repetitions INTEGER DEFAULT 0,

  -- Performance tracking
  correct_count INTEGER DEFAULT 0,
  incorrect_count INTEGER DEFAULT 0,

  -- Timestamps
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_practiced TIMESTAMP WITH TIME ZONE,
  last_revised TIMESTAMP WITH TIME ZONE,
  last_recalled TIMESTAMP WITH TIME ZONE,

  -- User notes
  personal_notes TEXT,

  UNIQUE(user_id, word_id)
);

-- Tracking for individual word info items (e.g., gender, past participle, etc.)
CREATE TABLE word_info_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_word_id UUID REFERENCES user_words(id) ON DELETE CASCADE NOT NULL,

  -- What aspect of the word this tracks
  info_type TEXT NOT NULL, -- e.g., 'gender', 'plural', 'past_participle', 'preposition_case'
  info_key TEXT, -- for arrays/objects, which specific item

  -- Learning status for this specific info item
  status TEXT DEFAULT 'revising' CHECK (status IN ('revising', 'recalling', 'practicing', 'mastered')),

  -- SRS data for this info item
  ease_factor FLOAT DEFAULT 2.5,
  interval INTEGER DEFAULT 0,
  repetitions INTEGER DEFAULT 0,
  next_review_date TIMESTAMP WITH TIME ZONE,
  priority_score FLOAT DEFAULT 0,

  -- Performance
  correct_count INTEGER DEFAULT 0,
  incorrect_count INTEGER DEFAULT 0,
  last_practiced TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Learning sessions
CREATE TABLE learning_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  session_type TEXT NOT NULL CHECK (session_type IN ('complete', 'quick', 'revise', 'recall', 'practice', 'specific_word')),

  -- Priority snapshot at session start
  priority_snapshot JSONB,

  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER
);

-- Session items (words/info items practiced in a session)
CREATE TABLE session_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id UUID REFERENCES learning_sessions(id) ON DELETE CASCADE NOT NULL,
  user_word_id UUID REFERENCES user_words(id) ON DELETE CASCADE NOT NULL,
  word_info_item_id UUID REFERENCES word_info_items(id) ON DELETE CASCADE,

  mode TEXT NOT NULL CHECK (mode IN ('revise', 'recall', 'practice')),

  -- Results
  correct BOOLEAN,
  attempts INTEGER DEFAULT 1,

  practiced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_user_words_user_id ON user_words(user_id);
CREATE INDEX idx_user_words_status ON user_words(status);
CREATE INDEX idx_user_words_next_review ON user_words(next_review_date);
CREATE INDEX idx_user_words_priority ON user_words(priority_score DESC);
CREATE INDEX idx_vocabulary_german ON vocabulary(german);
CREATE INDEX idx_vocabulary_type ON vocabulary(type);
CREATE INDEX idx_vocabulary_difficulty ON vocabulary(difficulty);
CREATE INDEX idx_word_info_items_user_word ON word_info_items(user_word_id);
CREATE INDEX idx_word_info_items_status ON word_info_items(status);
CREATE INDEX idx_sessions_user_id ON learning_sessions(user_id);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_words ENABLE ROW LEVEL SECURITY;
ALTER TABLE word_info_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own words" ON user_words
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own words" ON user_words
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own words" ON user_words
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own words" ON user_words
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own word info items" ON word_info_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_words
      WHERE user_words.id = word_info_items.user_word_id
      AND user_words.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own word info items" ON word_info_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_words
      WHERE user_words.id = word_info_items.user_word_id
      AND user_words.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own word info items" ON word_info_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_words
      WHERE user_words.id = word_info_items.user_word_id
      AND user_words.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view own sessions" ON learning_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions" ON learning_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions" ON learning_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own session items" ON session_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM learning_sessions
      WHERE learning_sessions.id = session_items.session_id
      AND learning_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own session items" ON session_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM learning_sessions
      WHERE learning_sessions.id = session_items.session_id
      AND learning_sessions.user_id = auth.uid()
    )
  );

-- Vocabulary is readable by all authenticated users
CREATE POLICY "Authenticated users can view vocabulary" ON vocabulary
  FOR SELECT USING (auth.role() = 'authenticated');

-- Functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vocabulary_updated_at BEFORE UPDATE ON vocabulary
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
