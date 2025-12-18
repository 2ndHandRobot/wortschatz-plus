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

async function testFilterLogic() {
  const listId = 'ce952c7d-e008-41bb-b266-810ce808d250'

  // Get list data (simulating what the API returns)
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
  console.log(`Language: ${targetLanguage}\n`)

  // Fetch list items (what fetchListMembership gets)
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

  const vocabularyIds = items?.map((item: any) => {
    if (item.vocabulary?.id) return item.vocabulary.id
    return item.vocabularyId || item.vocabulary_id
  }).filter(Boolean) || []

  console.log(`List items: ${items?.length}`)
  console.log(`Extracted vocabulary IDs: ${vocabularyIds.length}\n`)

  // Fetch user_words (what the dictionary page fetches)
  const { data: userWords } = await supabase
    .from('user_words')
    .select(`
      *,
      vocabulary!inner (*)
    `)
    .eq('user_id', userId)
    .eq('vocabulary.language', targetLanguage)

  console.log(`User words (total): ${userWords?.length}\n`)

  // Simulate the filter
  const filtered = userWords?.filter((word: any) => {
    if (!word.vocabulary) return false
    const isIncluded = vocabularyIds.includes(word.vocabulary.id)
    return isIncluded
  }) || []

  console.log(`Filtered words: ${filtered.length}`)
  console.log(`Expected: ${vocabularyIds.length}\n`)

  // Show words that are in the list but not in user_words
  const userWordVocabIds = new Set(userWords?.map((w: any) => w.word_id) || [])
  const missingFromUserWords = vocabularyIds.filter(id => !userWordVocabIds.has(id))

  if (missingFromUserWords.length > 0) {
    console.log(`\n❌ ${missingFromUserWords.length} vocabulary IDs in list are NOT in user_words`)
    console.log('First 5:', missingFromUserWords.slice(0, 5))
  } else {
    console.log('\n✓ All list vocabulary IDs are in user_words')
  }

  // Show words that are in user_words but not matching the filter
  const listVocabIdSet = new Set(vocabularyIds)
  const inUserWordsButNotFiltered = userWords?.filter((w: any) =>
    w.word_id && !listVocabIdSet.has(w.word_id)
  ) || []

  console.log(`\nWords in user_words for this language: ${userWords?.length}`)
  console.log(`Words matching list filter: ${filtered.length}`)
  console.log(`Words not matching: ${inUserWordsButNotFiltered.length}`)

  // Check for ID type mismatches
  if (vocabularyIds.length > 0 && userWords && userWords.length > 0) {
    const listIdType = typeof vocabularyIds[0]
    const userWordIdType = typeof userWords[0].word_id
    console.log(`\nID Types:`)
    console.log(`  List vocabulary IDs: ${listIdType} (example: ${vocabularyIds[0]})`)
    console.log(`  User word IDs: ${userWordIdType} (example: ${userWords[0].word_id})`)

    if (listIdType !== userWordIdType) {
      console.log(`\n❌ TYPE MISMATCH! This is likely the bug.`)
    }
  }
}

testFilterLogic().catch(console.error)
