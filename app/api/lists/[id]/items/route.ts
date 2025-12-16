import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST - Add a word to a list
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { vocabularyId } = await request.json()

    if (!vocabularyId) {
      return NextResponse.json({ error: 'Vocabulary ID is required' }, { status: 400 })
    }

    // Verify the list belongs to the user
    const { data: list } = await supabase
      .from('word_lists')
      .select('id, language')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!list) {
      return NextResponse.json({ error: 'List not found or unauthorized' }, { status: 404 })
    }

    // Verify the vocabulary item exists and matches list language
    const { data: vocab } = await supabase
      .from('vocabulary')
      .select('id, language')
      .eq('id', vocabularyId)
      .single()

    if (!vocab) {
      return NextResponse.json({ error: 'Vocabulary word not found' }, { status: 404 })
    }

    if (vocab.language !== list.language) {
      return NextResponse.json(
        { error: `This word is in ${vocab.language} but the list is for ${list.language}` },
        { status: 400 }
      )
    }

    // Check if word is already in the list
    const { data: existing } = await supabase
      .from('word_list_items')
      .select('id')
      .eq('list_id', id)
      .eq('vocabulary_id', vocabularyId)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'Word already in this list' }, { status: 409 })
    }

    // Add the word to the list
    const { data: listItem, error } = await supabase
      .from('word_list_items')
      .insert({
        list_id: id,
        vocabulary_id: vocabularyId,
        added_by: user.id,
      })
      .select(`
        id,
        list_id,
        vocabulary_id,
        added_at,
        added_by,
        vocabulary:vocabulary (*)
      `)
      .single()

    if (error) throw error

    return NextResponse.json({ item: listItem }, { status: 201 })
  } catch (error) {
    console.error('Add word to list error:', error)
    return NextResponse.json({ error: 'Failed to add word to list' }, { status: 500 })
  }
}

// DELETE - Remove a word from a list (by vocabularyId query param)
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const vocabularyId = searchParams.get('vocabularyId')

    if (!vocabularyId) {
      return NextResponse.json({ error: 'Vocabulary ID is required' }, { status: 400 })
    }

    // Verify the list belongs to the user
    const { data: list } = await supabase
      .from('word_lists')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!list) {
      return NextResponse.json({ error: 'List not found or unauthorized' }, { status: 404 })
    }

    // Delete the word from the list
    const { error } = await supabase
      .from('word_list_items')
      .delete()
      .eq('list_id', id)
      .eq('vocabulary_id', vocabularyId)

    if (error) throw error

    return NextResponse.json({ message: 'Word removed from list successfully' })
  } catch (error) {
    console.error('Remove word from list error:', error)
    return NextResponse.json({ error: 'Failed to remove word from list' }, { status: 500 })
  }
}
