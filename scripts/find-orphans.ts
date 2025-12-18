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

async function findOrphans() {
  const listId = 'ce952c7d-e008-41bb-b266-810ce808d250'

  console.log('Finding orphaned items for B2 Beruf list...\n')

  // Fetch all items for this list
  const { data: allItems, error: itemsError } = await supabase
    .from('word_list_items')
    .select(`
      id,
      list_id,
      vocabulary_id,
      added_at,
      vocabulary:vocabulary (
        id,
        target_word,
        type,
        language
      )
    `)
    .eq('list_id', listId)

  if (itemsError) {
    console.error('Error fetching items:', itemsError)
    process.exit(1)
  }

  // Separate orphaned items from valid items
  const orphanedItems = allItems?.filter(item => item.vocabulary === null) || []
  const validItems = allItems?.filter(item => item.vocabulary !== null) || []

  console.log(`Total items: ${allItems?.length || 0}`)
  console.log(`Valid items: ${validItems.length}`)
  console.log(`Orphaned items: ${orphanedItems.length}\n`)

  if (orphanedItems.length > 0) {
    console.log('First 10 orphaned items:\n')
    orphanedItems.slice(0, 10).forEach((item, index) => {
      console.log(`${index + 1}. ID: ${item.id}`)
      console.log(`   vocabulary_id: ${item.vocabulary_id}`)
      console.log(`   added_at: ${item.added_at}\n`)
    })
  }
}

findOrphans().catch(console.error)
