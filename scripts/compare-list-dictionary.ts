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

async function compareLists() {
  const listId = 'ce952c7d-e008-41bb-b266-810ce808d250'

  console.log('Comparing B2 Beruf list with personal dictionary...\n')

  // Get the list owner
  const { data: listData } = await supabase
    .from('word_lists')
    .select('user_id, name')
    .eq('id', listId)
    .single()

  if (!listData) {
    console.error('List not found')
    return
  }

  const userId = listData.user_id
  console.log(`List: ${listData.name}`)
  console.log(`User ID: ${userId}\n`)

  // Fetch all items in the list
  const { data: listItems } = await supabase
    .from('word_list_items')
    .select(`
      vocabulary_id,
      vocabulary:vocabulary (
        id,
        target_word,
        type,
        english
      )
    `)
    .eq('list_id', listId)

  const vocabularyIds = listItems?.map(item => item.vocabulary_id) || []
  console.log(`Total words in list: ${vocabularyIds.length}`)

  // Fetch user's dictionary entries for these vocabulary IDs
  const { data: userWords } = await supabase
    .from('user_words')
    .select('word_id')
    .eq('user_id', userId)
    .in('word_id', vocabularyIds)

  const userWordIds = new Set(userWords?.map(uw => uw.word_id) || [])
  console.log(`Words in personal dictionary: ${userWordIds.size}`)
  console.log(`Words NOT in dictionary: ${vocabularyIds.length - userWordIds.size}\n`)

  // Show first 10 words not in dictionary
  const missingWords = listItems?.filter(item => !userWordIds.has(item.vocabulary_id)) || []

  if (missingWords.length > 0) {
    console.log(`First 10 words NOT in your personal dictionary:\n`)
    missingWords.slice(0, 10).forEach((item, index) => {
      const vocab = item.vocabulary as any
      console.log(`${index + 1}. ${vocab.target_word} (${vocab.type})`)
      console.log(`   English: ${vocab.english?.slice(0, 3).join(', ')}`)
      console.log(`   ID: ${item.vocabulary_id}\n`)
    })

    console.log(`\n... and ${missingWords.length - 10} more words not in your dictionary.`)
  }
}

compareLists().catch(console.error)
