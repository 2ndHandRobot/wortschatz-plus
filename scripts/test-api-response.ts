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

// Import the route handler logic
async function simulateAPICall() {
  const listId = 'ce952c7d-e008-41bb-b266-810ce808d250'

  // Get list owner for auth simulation
  const { data: listData } = await supabase
    .from('word_lists')
    .select('user_id')
    .eq('id', listId)
    .single()

  if (!listData) {
    console.error('List not found')
    return
  }

  const userId = listData.user_id

  // Simulate the exact API logic from /api/lists/[id]/route.ts
  const { data: list, error: listError } = await supabase
    .from('word_lists')
    .select('*')
    .eq('id', listId)
    .or(`user_id.eq.${userId},is_public.eq.true`)
    .single()

  if (listError || !list) {
    console.error('List not found:', listError)
    return
  }

  // Fetch items with vocabulary details
  const { data: items, error: itemsError } = await supabase
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

  if (itemsError) {
    console.error('Items error:', itemsError)
    return
  }

  console.log(`\nAPI Response Simulation for /api/lists/${listId}:\n`)
  console.log(`Total items returned: ${items?.length || 0}`)
  console.log(`Items with vocabulary: ${items?.filter((i: any) => i.vocabulary !== null).length || 0}`)
  console.log(`Items WITHOUT vocabulary: ${items?.filter((i: any) => i.vocabulary === null).length || 0}\n`)

  if (items && items.length > 0) {
    console.log('First item structure:')
    console.log(JSON.stringify(items[0], null, 2).slice(0, 500))
  }

  // Extract vocabulary IDs like the frontend does
  const vocabularyIds = items?.map((item: any) => {
    if (item.vocabulary?.id) return item.vocabulary.id
    return item.vocabularyId || item.vocabulary_id
  }).filter(Boolean) || []

  console.log(`\nExtracted vocabulary IDs: ${vocabularyIds.length}`)
  console.log('First 5 IDs:', vocabularyIds.slice(0, 5))
}

simulateAPICall().catch(console.error)
