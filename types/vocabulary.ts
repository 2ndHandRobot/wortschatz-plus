// Base entry structure
export interface BaseVocabularyEntry {
  id: string
  type: WordType
  german: string
  english: string[]
  difficulty?: Difficulty
  tags?: string[]
  examples?: Example[]
  notes?: string
  audioUrl?: string
  createdAt?: string
  lastReviewed?: string
  prepositionCase?: PrepositionCase[] | null
}

export type WordType =
  | 'noun'
  | 'verb'
  | 'adjective'
  | 'adverb'
  | 'pronoun'
  | 'article'
  | 'preposition'
  | 'conjunction'
  | 'expression'
  | 'collocation'

export type Difficulty = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'

export type Gender = 'masculine' | 'feminine' | 'neuter'

export type GrammaticalCase = 'accusative' | 'dative' | 'genitive'

export interface Example {
  german: string
  english: string
}

export interface PrepositionCase {
  preposition: string
  case: GrammaticalCase
}

// Noun
export interface NounEntry extends BaseVocabularyEntry {
  type: 'noun'
  article?: string
  gender?: Gender
  plural?: string
  genitive?: string
  weak?: boolean
  compound?: {
    isCompound: boolean
    components: string[]
  }
}

// Verb
export interface VerbEntry extends BaseVocabularyEntry {
  type: 'verb'
  infinitive?: string
  auxiliary?: 'haben' | 'sein'
  separable?: {
    isSeparable: boolean
    prefix?: string
    stem?: string
  }
  reflexive?: {
    isReflexive: boolean
    reflexiveCase?: 'accusative' | 'dative'
  }
  transitivity?: 'transitive' | 'intransitive' | 'both'
  conjugation?: {
    present?: {
      ich?: string
      du?: string
      er_sie_es?: string
      wir?: string
      ihr?: string
      sie_Sie?: string
    }
    preterite?: {
      ich?: string
      du?: string
      er_sie_es?: string
      wir?: string
      ihr?: string
      sie_Sie?: string
    }
    perfect?: string
    imperative?: {
      du?: string
      ihr?: string
      Sie?: string
    }
  }
}

// Adjective
export interface AdjectiveEntry extends BaseVocabularyEntry {
  type: 'adjective'
  base?: string
  comparative?: string
  superlative?: string
  irregular?: boolean
  predicativeOnly?: boolean
}

// Adverb
export interface AdverbEntry extends BaseVocabularyEntry {
  type: 'adverb'
  category?: 'time' | 'place' | 'manner' | 'degree' | 'frequency'
  comparative?: string
  superlative?: string
}

// Pronoun
export interface PronounEntry extends BaseVocabularyEntry {
  type: 'pronoun'
  pronounType?:
    | 'personal'
    | 'possessive'
    | 'demonstrative'
    | 'relative'
    | 'interrogative'
    | 'reflexive'
    | 'indefinite'
  declension?: {
    nominative?: string
    accusative?: string
    dative?: string
    genitive?: string
  }
  person?: 'first' | 'second' | 'third'
  number?: 'singular' | 'plural'
  gender?: Gender | null
}

// Article
export interface ArticleEntry extends BaseVocabularyEntry {
  type: 'article'
  articleType?: 'definite' | 'indefinite' | 'negative'
  declension?: {
    masculine?: {
      nominative?: string
      accusative?: string
      dative?: string
      genitive?: string
    }
    feminine?: {
      nominative?: string
      accusative?: string
      dative?: string
      genitive?: string
    }
    neuter?: {
      nominative?: string
      accusative?: string
      dative?: string
      genitive?: string
    }
    plural?: {
      nominative?: string
      accusative?: string
      dative?: string
      genitive?: string
    }
  }
}

// Preposition
export interface PrepositionEntry extends BaseVocabularyEntry {
  type: 'preposition'
  governsCase?: GrammaticalCase[]
  twoWay?: boolean
  contracted?: Array<{
    form: string
    expanded: string
  }>
}

// Conjunction
export interface ConjunctionEntry extends BaseVocabularyEntry {
  type: 'conjunction'
  conjunctionType?: 'coordinating' | 'subordinating' | 'correlative'
  affectsWordOrder?: boolean
  correlativePair?: string
}

// Expression
export interface ExpressionEntry extends BaseVocabularyEntry {
  type: 'expression'
  literal?: string
  register?: 'formal' | 'informal' | 'colloquial' | 'slang' | 'vulgar'
  category?: string
  relatedWords?: string[]
}

// Collocation
export interface CollocationEntry extends BaseVocabularyEntry {
  type: 'collocation'
  structure?: string
  components?: Array<{
    wordId: string
    word: string
    type: string
  }>
  strength?: 'strong' | 'medium' | 'weak'
  alternative?: string
}

// Union type for all vocabulary entries
export type VocabularyEntry =
  | NounEntry
  | VerbEntry
  | AdjectiveEntry
  | AdverbEntry
  | PronounEntry
  | ArticleEntry
  | PrepositionEntry
  | ConjunctionEntry
  | ExpressionEntry
  | CollocationEntry

// User-specific data
export interface UserWord {
  id: string
  userId: string
  wordId: string
  status: 'revising' | 'recalling' | 'practicing' | 'mastered'
  priorityScore: number
  nextReviewDate?: string
  easeFactor: number
  interval: number
  repetitions: number
  correctCount: number
  incorrectCount: number
  addedAt: string
  lastPracticed?: string
  lastRevised?: string
  lastRecalled?: string
  personalNotes?: string
  vocabulary?: VocabularyEntry
}

export interface WordInfoItem {
  id: string
  userWordId: string
  infoType: string
  infoKey?: string
  status: 'revising' | 'recalling' | 'practicing' | 'mastered'
  easeFactor: number
  interval: number
  repetitions: number
  nextReviewDate?: string
  priorityScore: number
  correctCount: number
  incorrectCount: number
  lastPracticed?: string
  createdAt: string
}

export interface Profile {
  id: string
  email: string
  full_name?: string | null
  target_daily_learning_time: number
  claude_api_key?: string | null
  created_at: string
  updated_at: string
}

export type SessionType = 'complete' | 'quick' | 'revise' | 'recall' | 'practice' | 'specific_word'

export interface LearningSession {
  id: string
  userId: string
  sessionType: SessionType
  prioritySnapshot?: Record<string, unknown>
  startedAt: string
  completedAt?: string
  durationSeconds?: number
}

export interface SessionItem {
  id: string
  sessionId: string
  userWordId: string
  wordInfoItemId?: string
  mode: 'revise' | 'recall' | 'practice'
  correct?: boolean
  attempts: number
  practicedAt: string
}
