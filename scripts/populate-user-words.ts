import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

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

async function populateUserWords(userEmail?: string) {
  console.log('Fetching users...')

  // Get user(s)
  let users: any[] = []

  if (userEmail) {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', userEmail)
      .single()

    if (profileError || !profile) {
      console.error(`User with email ${userEmail} not found`)
      process.exit(1)
    }

    users = [profile]
  } else {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email')

    if (profilesError || !profiles || profiles.length === 0) {
      console.error('No users found in the database')
      process.exit(1)
    }

    users = profiles
  }

  console.log(`Found ${users.length} user(s)`)

  // Get all vocabulary words
  console.log('Fetching all vocabulary words...')
  const { data: vocabularyWords, error: vocabError } = await supabase
    .from('vocabulary')
    .select('id, german, type')

  if (vocabError || !vocabularyWords) {
    console.error('Error fetching vocabulary:', vocabError)
    process.exit(1)
  }

  console.log(`Found ${vocabularyWords.length} vocabulary words`)

  // For each user, add all words that they don't already have
  for (const user of users) {
    console.log(`\nProcessing user: ${user.email} (${user.id})`)

    // Check which words the user already has
    const { data: existingWords, error: existingError } = await supabase
      .from('user_words')
      .select('word_id')
      .eq('user_id', user.id)

    if (existingError) {
      console.error(`Error fetching existing words for ${user.email}:`, existingError)
      continue
    }

    const existingWordIds = new Set(existingWords?.map(w => w.word_id) || [])
    console.log(`User already has ${existingWordIds.size} words`)

    // Filter out words the user already has
    const wordsToAdd = vocabularyWords.filter(word => !existingWordIds.has(word.id))

    if (wordsToAdd.length === 0) {
      console.log('User already has all vocabulary words!')
      continue
    }

    console.log(`Adding ${wordsToAdd.length} new words to user's dictionary...`)

    // Prepare user_words entries
    const userWordsEntries = wordsToAdd.map(word => ({
      user_id: user.id,
      word_id: word.id,
      status: 'revising',
      priority_score: 0,
      ease_factor: 2.5,
      interval: 0,
      repetitions: 0,
      correct_count: 0,
      incorrect_count: 0
    }))

    // Insert in batches
    const batchSize = 100
    let inserted = 0
    let errors = 0

    for (let i = 0; i < userWordsEntries.length; i += batchSize) {
      const batch = userWordsEntries.slice(i, i + batchSize)

      console.log(`  Inserting batch ${Math.floor(i / batchSize) + 1} (${i + 1}-${Math.min(i + batchSize, userWordsEntries.length)} of ${userWordsEntries.length})...`)

      const { error } = await supabase
        .from('user_words')
        .insert(batch)

      if (error) {
        console.error(`  Error inserting batch:`, error)
        errors += batch.length
      } else {
        inserted += batch.length
        console.log(`  Successfully inserted ${batch.length} words`)
      }
    }

    console.log(`\nResults for ${user.email}:`)
    console.log(`  Total words to add: ${wordsToAdd.length}`)
    console.log(`  Successfully inserted: ${inserted}`)
    console.log(`  Errors: ${errors}`)
  }

  console.log('\n=== All users processed ===')
}

// Get user email from command line args if provided
const userEmail = process.argv[2]

if (userEmail) {
  console.log(`Adding words for specific user: ${userEmail}\n`)
} else {
  console.log('Adding words for ALL users\n')
}

populateUserWords(userEmail)
  .then(() => {
    console.log('\nPopulation finished successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\nPopulation failed:', error)
    process.exit(1)
  })
