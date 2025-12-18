import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET - Find orphaned items (word_list_items with missing vocabulary references)
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
      .eq('list_id', id)

    if (itemsError) throw itemsError

    // Separate orphaned items (where vocabulary is null) from valid items
    const orphanedItems = allItems?.filter(item => item.vocabulary === null) || []
    const validItems = allItems?.filter(item => item.vocabulary !== null) || []

    return NextResponse.json({
      total: allItems?.length || 0,
      valid: validItems.length,
      orphaned: orphanedItems.length,
      orphanedItems: orphanedItems.map(item => ({
        id: item.id,
        vocabulary_id: item.vocabulary_id,
        added_at: item.added_at,
      })),
    })
  } catch (error) {
    console.error('Fetch orphaned items error:', error)
    return NextResponse.json({ error: 'Failed to fetch orphaned items' }, { status: 500 })
  }
}
