import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET - Fetch a specific list by ID with its items
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

    // Fetch the list (user's own or public)
    const { data: list, error: listError } = await supabase
      .from('word_lists')
      .select('*')
      .eq('id', id)
      .or(`user_id.eq.${user.id},is_public.eq.true`)
      .single()

    if (listError || !list) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 })
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
      .eq('list_id', id)
      .order('added_at', { ascending: false })

    if (itemsError) throw itemsError

    return NextResponse.json({
      list: {
        ...list,
        items,
        itemCount: items?.length || 0,
      },
    })
  } catch (error) {
    console.error('Fetch list error:', error)
    return NextResponse.json({ error: 'Failed to fetch list' }, { status: 500 })
  }
}

// PUT - Update a list
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, description, isPublic } = await request.json()

    if (name !== undefined && (!name || name.trim().length === 0)) {
      return NextResponse.json({ error: 'List name cannot be empty' }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name.trim()
    if (description !== undefined) updateData.description = description?.trim() || null
    if (isPublic !== undefined) updateData.is_public = isPublic

    const { data: updatedList, error } = await supabase
      .from('word_lists')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error || !updatedList) {
      return NextResponse.json({ error: 'List not found or unauthorized' }, { status: 404 })
    }

    return NextResponse.json({ list: updatedList })
  } catch (error) {
    console.error('Update list error:', error)
    return NextResponse.json({ error: 'Failed to update list' }, { status: 500 })
  }
}

// DELETE - Delete a list
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

    // Delete list (items and access will cascade delete)
    const { error } = await supabase
      .from('word_lists')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error

    return NextResponse.json({ message: 'List deleted successfully' })
  } catch (error) {
    console.error('Delete list error:', error)
    return NextResponse.json({ error: 'Failed to delete list' }, { status: 500 })
  }
}
