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
