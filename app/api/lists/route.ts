import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET - Fetch all lists for the authenticated user
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch user's lists with item counts
    const { data: lists, error } = await supabase
      .from('word_lists')
      .select(`
        *,
        word_list_items (count)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Transform the count data
    const listsWithCounts = lists?.map((list) => ({
      ...list,
      itemCount: list.word_list_items?.[0]?.count || 0,
      word_list_items: undefined, // remove the raw count data
    }))

    return NextResponse.json({ lists: listsWithCounts })
  } catch (error) {
    console.error('Fetch lists error:', error)
    return NextResponse.json({ error: 'Failed to fetch lists' }, { status: 500 })
  }
}

// POST - Create a new list
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, description, language } = await request.json()

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: 'List name is required' }, { status: 400 })
    }

    if (!language) {
      return NextResponse.json({ error: 'Language is required' }, { status: 400 })
    }

    // Get user's target language as default
    const { data: profile } = await supabase
      .from('profiles')
      .select('target_language')
      .eq('id', user.id)
      .single()

    const targetLanguage = language || profile?.target_language || 'german'

    const { data: newList, error } = await supabase
      .from('word_lists')
      .insert({
        user_id: user.id,
        name: name.trim(),
        description: description?.trim() || null,
        language: targetLanguage,
        is_public: false,
      })
      .select()
      .single()

    if (error) throw error

    // Add the user as owner in access table
    await supabase.from('word_list_access').insert({
      list_id: newList.id,
      user_id: user.id,
      access_type: 'owner',
    })

    return NextResponse.json({ list: { ...newList, itemCount: 0 } }, { status: 201 })
  } catch (error) {
    console.error('Create list error:', error)
    return NextResponse.json({ error: 'Failed to create list' }, { status: 500 })
  }
}
