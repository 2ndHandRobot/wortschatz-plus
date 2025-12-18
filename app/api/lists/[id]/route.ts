import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { calculatePriorityScore } from '@/lib/spaced-repetition'

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

    // Fetch user_words data for priority calculation (only for user's own list)
    let itemsWithPriority = items || []

    if (list.user_id === user.id && items && items.length > 0) {
      const vocabularyIds = items.map(item => item.vocabulary_id)

      const { data: userWords, error: userWordsError } = await supabase
        .from('user_words')
        .select('*')
        .eq('user_id', user.id)
        .in('word_id', vocabularyIds)

      if (!userWordsError && userWords) {
        // Create a map of vocabulary_id -> user_word
        const userWordMap = new Map(userWords.map(uw => [uw.word_id, uw]))

        // Add priority scores to items
        itemsWithPriority = items.map(item => {
          const userWord = userWordMap.get(item.vocabulary_id)

          if (userWord) {
            const priorityScore = calculatePriorityScore({
              status: userWord.status,
              nextReviewDate: userWord.next_review_date,
              easeFactor: userWord.ease_factor,
              repetitions: userWord.repetitions,
              incorrectCount: userWord.incorrect_count,
              correctCount: userWord.correct_count,
              lastPracticed: userWord.last_practiced,
              addedAt: userWord.added_at,
              difficulty: item.vocabulary?.difficulty || null,
            })

            return {
              ...item,
              priorityScore,
              userWord,
            }
          }

          return {
            ...item,
            priorityScore: 0, // Not in user's dictionary
            userWord: null,
          }
        })

        // Sort by priority (highest first)
        itemsWithPriority.sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0))
      }
    }

    return NextResponse.json({
      list: {
        ...list,
        items: itemsWithPriority,
        itemCount: itemsWithPriority?.length || 0,
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
