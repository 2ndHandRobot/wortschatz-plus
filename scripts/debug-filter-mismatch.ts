import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function debugFilterMismatch() {
  const listId = 'ce952c7d-e008-41bb-b266-810ce808d250'

  // Get list info
  const { data: list } = await supabase
    .from('word_lists')
    .select('user_id, language, name')
    .eq('id', listId)
    .single()

  if (!list) {
    console.error('List not found')
    return
  }

  const userId = list.user_id
  const targetLanguage = list.language

  console.log(`List: ${list.name}`)
  console.log(`Language: ${targetLanguage}`)
  console.log(`User ID: ${userId}\n`)

  // Step 1: Get list membership (what the frontend loads)
  const { data: items } = await supabase
    .from('word_list_items')
    .select(`
      id,
      list_id,
      vocabulary_id,
      added_at,
      added_by,
      vocabulary:vocabulary (*)
    `)
    .eq('list_id', listId)
    .order('added_at', { ascending: false })

  const listMemberships = items?.map((item: any) => {
    if (item.vocabulary?.id) return item.vocabulary.id
    return item.vocabularyId || item.vocabulary_id
  }).filter(Boolean) || []

  console.log(`Step 1: List membership loaded`)
  console.log(`  Total items: ${items?.length}`)
  console.log(`  Vocabulary IDs extracted: ${listMemberships.length}`)
  console.log(`  First 5 IDs:`, listMemberships.slice(0, 5))
  console.log()

  // Step 2: Get user's dictionary (what the words state contains)
  const { data: userWords } = await supabase
    .from('user_words')
    .select(`
      *,
      vocabulary!inner (*)
    `)
    .eq('user_id', userId)
    .eq('vocabulary.language', targetLanguage)

  console.log(`Step 2: User dictionary loaded`)
  console.log(`  Total words: ${userWords?.length}`)
  console.log()

  // Step 3: Simulate the filter
  const filtered = userWords?.filter((word: any) => {
    if (!word.vocabulary) return false
    const isIncluded = listMemberships.includes(word.vocabulary.id)
    return isIncluded
  }) || []

  console.log(`Step 3: Filter simulation`)
  console.log(`  Words before filter: ${userWords?.length}`)
  console.log(`  Words after filter: ${filtered.length}`)
  console.log(`  Expected: ${listMemberships.length}`)
  console.log()

  // Step 4: Find the mismatch - words in list but not matching
  const userWordVocabIds = new Set(userWords?.map((w: any) => w.vocabulary?.id).filter(Boolean) || [])
  const listMembershipSet = new Set(listMemberships)

  const inListButNotInDictionary = listMemberships.filter(id => !userWordVocabIds.has(id))
  const inDictionaryButNotMatching = userWords?.filter((w: any) =>
    w.vocabulary?.id &&
    !listMembershipSet.has(w.vocabulary.id)
  ) || []

  console.log(`Step 4: Mismatch analysis`)
  console.log(`  IDs in list but NOT in dictionary: ${inListButNotInDictionary.length}`)
  if (inListButNotInDictionary.length > 0) {
    console.log(`  First 5:`, inListButNotInDictionary.slice(0, 5))
  }
  console.log()

  // Step 5: Check the specific word the user mentioned
  const testId = 'col-1766004979680-cf98nkc'
  console.log(`Step 5: Checking specific word: ${testId}`)
  console.log(`  In list memberships? ${listMemberships.includes(testId)}`)
  console.log(`  In user dictionary? ${userWordVocabIds.has(testId)}`)

  const userWordWithId = userWords?.find((w: any) => w.vocabulary?.id === testId)
  if (userWordWithId) {
    console.log(`  Found in user_words:`)
    console.log(`    user_word.id: ${userWordWithId.id}`)
    console.log(`    user_word.word_id: ${userWordWithId.word_id}`)
    console.log(`    user_word.vocabulary.id: ${userWordWithId.vocabulary?.id}`)
    console.log(`    Match result: ${listMemberships.includes(userWordWithId.vocabulary?.id)}`)
  } else {
    console.log(`  NOT found in user_words query result`)
  }
  console.log()

  // Step 6: Check for data type issues
  console.log(`Step 6: Data type check`)
  if (listMemberships.length > 0 && userWords && userWords.length > 0) {
    const sampleListId = listMemberships[0]
    const sampleWordId = userWords[0].vocabulary?.id

    console.log(`  Sample list ID: "${sampleListId}" (type: ${typeof sampleListId})`)
    console.log(`  Sample word ID: "${sampleWordId}" (type: ${typeof sampleWordId})`)
    console.log(`  Are they the same type? ${typeof sampleListId === typeof sampleWordId}`)

    // Check for whitespace or hidden characters
    console.log(`  List ID length: ${sampleListId.length}`)
    console.log(`  Word ID length: ${sampleWordId?.length}`)
  }
  console.log()

  // Step 7: Show matched vs unmatched words
  console.log(`Step 7: Sample matched and unmatched words`)
  const matchedWords = userWords?.filter((w: any) =>
    w.vocabulary?.id && listMemberships.includes(w.vocabulary.id)
  ) || []
  const unmatchedWords = userWords?.filter((w: any) =>
    w.vocabulary?.id && !listMemberships.includes(w.vocabulary.id)
  ) || []

  console.log(`\nMatched words (showing first 3):`)
  matchedWords.slice(0, 3).forEach((w: any) => {
    console.log(`  ✓ ${(w.vocabulary as any)?.target_word} (${(w.vocabulary as any)?.id})`)
  })

  console.log(`\nUnmatched words from list (showing first 10):`)
  const unmatchedFromList = listMemberships.filter(id => {
    const found = userWords?.find((w: any) => w.vocabulary?.id === id)
    return !found
  })
  unmatchedFromList.slice(0, 10).forEach(id => {
    const item = items?.find((i: any) => i.vocabulary?.id === id)
    console.log(`  ✗ ${(item?.vocabulary as any)?.target_word || 'unknown'} (${id})`)
  })
}

debugFilterMismatch().catch(console.error)
