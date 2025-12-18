import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET - Fetch a public list by share code
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params
    const supabase = await createClient()

    // Fetch the list by share code (must be public)
    const { data: list, error: listError } = await supabase
      .from('word_lists')
      .select('*')
      .eq('share_code', code)
      .eq('is_public', true)
      .single()

    if (listError || !list) {
      return NextResponse.json({ error: 'List not found or not public' }, { status: 404 })
    }

    // Fetch items with vocabulary details
    const { data: items, error: itemsError } = await supabase
      .from('word_list_items')
      .select(`
        id,
        list_id,
        vocabulary_id,
        added_at,
        vocabulary:vocabulary (*)
      `)
      .eq('list_id', list.id)
      .order('added_at', { ascending: false })

    if (itemsError) throw itemsError

    // Fetch creator profile (name only, for attribution)
    const { data: creator } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', list.user_id)
      .single()

    return NextResponse.json({
      list: {
        ...list,
        items,
        itemCount: items?.length || 0,
        creator: {
          name: creator?.full_name || creator?.email?.split('@')[0] || 'Anonymous',
        },
      },
    })
  } catch (error) {
    console.error('Fetch shared list error:', error)
    return NextResponse.json({ error: 'Failed to fetch shared list' }, { status: 500 })
  }
}

// POST - Import a shared list into user's own lists
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params
    const body = await request.json()
    const { addToDictionary = true } = body // Default to true

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch the shared list
    const { data: sharedList, error: listError } = await supabase
      .from('word_lists')
      .select('*')
      .eq('share_code', code)
      .eq('is_public', true)
      .single()

    if (listError || !sharedList) {
      return NextResponse.json({ error: 'List not found or not public' }, { status: 404 })
    }

    // Create a copy of the list for the user
    const { data: newList, error: createError } = await supabase
      .from('word_lists')
      .insert({
        user_id: user.id,
        name: `${sharedList.name} (imported)`,
        description: sharedList.description,
        language: sharedList.language,
        is_public: false,
      })
      .select()
      .single()

    if (createError) throw createError

    // Add user as owner in access table
    await supabase.from('word_list_access').insert({
      list_id: newList.id,
      user_id: user.id,
      access_type: 'owner',
    })

    // Fetch all items from the shared list
    const { data: sharedItems } = await supabase
      .from('word_list_items')
      .select('vocabulary_id')
      .eq('list_id', sharedList.id)

    // Copy all items to the new list
    if (sharedItems && sharedItems.length > 0) {
      const itemsToInsert = sharedItems.map((item) => ({
        list_id: newList.id,
        vocabulary_id: item.vocabulary_id,
        added_by: user.id,
      }))

      await supabase.from('word_list_items').insert(itemsToInsert)

      // Add words to user's dictionary if requested
      if (addToDictionary) {
        // Get existing user words to avoid duplicates
        const { data: existingUserWords } = await supabase
          .from('user_words')
          .select('word_id')
          .eq('user_id', user.id)
          .in(
            'word_id',
            sharedItems.map((item) => item.vocabulary_id)
          )

        const existingWordIds = new Set(existingUserWords?.map((w) => w.word_id) || [])

        // Filter out words that are already in user's dictionary
        const newWordsToAdd = sharedItems
          .filter((item) => !existingWordIds.has(item.vocabulary_id))
          .map((item) => ({
            user_id: user.id,
            word_id: item.vocabulary_id,
            status: 'revising',
            priority_score: 80,
            ease_factor: 2.5,
            interval: 0,
            repetitions: 0,
            correct_count: 0,
            incorrect_count: 0,
            next_review_date: new Date().toISOString(),
          }))

        // Bulk insert new words into user_words
        if (newWordsToAdd.length > 0) {
          await supabase.from('user_words').insert(newWordsToAdd)
        }

        // Update priority for existing words
        if (existingWordIds.size > 0) {
          // Get full details of existing words to update priority
          const { data: existingWords } = await supabase
            .from('user_words')
            .select('id, priority_score, status')
            .eq('user_id', user.id)
            .in('word_id', Array.from(existingWordIds))

          // Update each existing word's priority
          if (existingWords) {
            for (const word of existingWords) {
              const newPriorityScore = Math.min(word.priority_score + 10, 100)
              await supabase
                .from('user_words')
                .update({
                  priority_score: newPriorityScore,
                  status: word.status === 'mastered' ? 'recalling' : word.status,
                })
                .eq('id', word.id)
            }
          }
        }
      }
    }

    return NextResponse.json({
      message: 'List imported successfully',
      list: {
        ...newList,
        itemCount: sharedItems?.length || 0,
      },
    })
  } catch (error) {
    console.error('Import shared list error:', error)
    return NextResponse.json({ error: 'Failed to import list' }, { status: 500 })
  }
}
