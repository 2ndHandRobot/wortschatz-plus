import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:')
  console.error('NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl)
  console.error('SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey)
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

interface VocabularyWord {
  id: string
  type: string
  german: string
  english: string[]
  difficulty?: string
  reviewPriority?: {
    important: boolean
    frequent: boolean
  }
  tags?: string[]
  examples?: any[]
  notes?: string
  audioUrl?: string
  createdAt?: string
  lastReviewed?: string

  // Noun fields
  article?: string
  gender?: string
  plural?: string
  genitive?: string
  weak?: boolean
  compound?: any

  // Verb fields
  infinitive?: string
  auxiliary?: string
  separable?: any
  reflexive?: any
  transitivity?: string
  conjugation?: any

  // Adjective fields
  base?: string
  comparative?: string
  superlative?: string
  irregular?: boolean
  predicativeOnly?: boolean

  // Adverb fields
  category?: string

  // Pronoun fields
  pronounType?: string
  declension?: any
  person?: string
  number?: string

  // Article fields
  articleType?: string

  // Preposition fields
  governsCase?: string[]
  twoWay?: boolean
  contracted?: any

  // Conjunction fields
  conjunctionType?: string
  affectsWordOrder?: boolean
  correlativePair?: string

  // Expression fields
  literal?: string
  register?: string
  expressionCategory?: string
  relatedWords?: string[]

  // Collocation fields
  structure?: string
  components?: any
  strength?: string
  alternative?: string

  // Shared field
  prepositionCase?: any
}

interface VocabularyDatabase {
  nouns: VocabularyWord[]
  verbs: VocabularyWord[]
  adjectives: VocabularyWord[]
  adverbs: VocabularyWord[]
  pronouns: VocabularyWord[]
  articles: VocabularyWord[]
  prepositions: VocabularyWord[]
  conjunctions: VocabularyWord[]
  expressions: VocabularyWord[]
  collocations: VocabularyWord[]
}

// Map word object to database schema (only include valid fields)
function mapToDbSchema(word: any): any {
  const mapped: any = {
    id: word.id,
    type: word.type,
    german: word.german,
    english: word.english,
    difficulty: word.difficulty,
    tags: word.tags || [],
    examples: word.examples || [],
    notes: word.notes || '',
    audio_url: word.audio_url || word.audioUrl || '',
  }

  // Add type-specific fields based on the word type
  if (word.type === 'noun') {
    mapped.article = word.article
    mapped.gender = word.gender
    mapped.plural = word.plural
    mapped.genitive = word.genitive
    mapped.weak = word.weak
    mapped.compound = word.compound
    mapped.preposition_case = word.preposition_case || word.prepositionCase
  } else if (word.type === 'verb') {
    mapped.infinitive = word.infinitive
    mapped.auxiliary = word.auxiliary
    mapped.separable = word.separable
    mapped.reflexive = word.reflexive
    mapped.transitivity = word.transitivity
    mapped.conjugation = word.conjugation
  } else if (word.type === 'adjective') {
    mapped.base = word.base
    mapped.comparative = word.comparative
    mapped.superlative = word.superlative
    mapped.irregular = word.irregular
    mapped.predicative_only = word.predicative_only || word.predicativeOnly
  } else if (word.type === 'adverb') {
    mapped.category = word.category
  } else if (word.type === 'pronoun') {
    mapped.pronoun_type = word.pronoun_type || word.pronounType
    mapped.declension = word.declension
    mapped.person = word.person
    mapped.number = word.number
  } else if (word.type === 'article') {
    mapped.article_type = word.article_type || word.articleType
  } else if (word.type === 'preposition') {
    mapped.governs_case = word.governs_case || word.governsCase
    mapped.two_way = word.two_way || word.twoWay
    mapped.contracted = word.contracted
  } else if (word.type === 'conjunction') {
    mapped.conjunction_type = word.conjunction_type || word.conjunctionType
    mapped.affects_word_order = word.affects_word_order || word.affectsWordOrder
    mapped.correlative_pair = word.correlative_pair || word.correlativePair
  } else if (word.type === 'expression') {
    mapped.literal = word.literal
    mapped.register = word.register
    mapped.expression_category = word.expression_category || word.expressionCategory
    mapped.related_words = word.related_words || word.relatedWords
  } else if (word.type === 'collocation') {
    mapped.structure = word.structure
    mapped.components = word.components
    mapped.strength = word.strength
    mapped.alternative = word.alternative
  }

  return mapped
}

async function importVocabulary() {
  const jsonPath = path.join(__dirname, '..', '..', 'german_vocabulary_database.json')

  console.log('Reading vocabulary database from:', jsonPath)
  const rawData = fs.readFileSync(jsonPath, 'utf-8')
  const data: VocabularyDatabase = JSON.parse(rawData)

  const allWords: VocabularyWord[] = [
    ...(data.nouns || []),
    ...(data.verbs || []),
    ...(data.adjectives || []),
    ...(data.adverbs || []),
    ...(data.pronouns || []),
    ...(data.articles || []),
    ...(data.prepositions || []),
    ...(data.conjunctions || []),
    ...(data.expressions || []),
    ...(data.collocations || [])
  ]

  console.log(`Found ${allWords.length} total words to import`)
  console.log(`  Nouns: ${data.nouns?.length || 0}`)
  console.log(`  Verbs: ${data.verbs?.length || 0}`)
  console.log(`  Adjectives: ${data.adjectives?.length || 0}`)
  console.log(`  Adverbs: ${data.adverbs?.length || 0}`)
  console.log(`  Pronouns: ${data.pronouns?.length || 0}`)
  console.log(`  Articles: ${data.articles?.length || 0}`)
  console.log(`  Prepositions: ${data.prepositions?.length || 0}`)
  console.log(`  Conjunctions: ${data.conjunctions?.length || 0}`)
  console.log(`  Expressions: ${data.expressions?.length || 0}`)
  console.log(`  Collocations: ${data.collocations?.length || 0}`)

  // Convert to database format
  const dbWords = allWords.map(word => mapToDbSchema(word))

  // Insert in batches to avoid timeout
  const batchSize = 100
  let inserted = 0
  let errors = 0

  for (let i = 0; i < dbWords.length; i += batchSize) {
    const batch = dbWords.slice(i, i + batchSize)

    console.log(`Inserting batch ${Math.floor(i / batchSize) + 1} (${i + 1}-${Math.min(i + batchSize, dbWords.length)} of ${dbWords.length})...`)

    const { data: insertedData, error } = await supabase
      .from('vocabulary')
      .upsert(batch, { onConflict: 'id' })

    if (error) {
      console.error(`Error inserting batch:`, error)
      errors += batch.length
    } else {
      inserted += batch.length
      console.log(`  Successfully inserted ${batch.length} words`)
    }
  }

  console.log('\n=== Import Complete ===')
  console.log(`Total words processed: ${dbWords.length}`)
  console.log(`Successfully inserted: ${inserted}`)
  console.log(`Errors: ${errors}`)
}

importVocabulary()
  .then(() => {
    console.log('Import finished successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Import failed:', error)
    process.exit(1)
  })
