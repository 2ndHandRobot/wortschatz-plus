import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { VocabularyEntry } from '@/types/vocabulary'

export async function PUT(request: Request) {
  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, ...updateData } = body as VocabularyEntry

    if (!id) {
      return NextResponse.json({ error: 'Word ID is required' }, { status: 400 })
    }

    // Verify the user owns this word by checking user_words
    const { data: userWord, error: userWordError } = await supabase
      .from('user_words')
      .select('word_id')
      .eq('user_id', user.id)
      .eq('word_id', id)
      .single()

    if (userWordError || !userWord) {
      return NextResponse.json(
        { error: 'Word not found or you do not have permission to edit it' },
        { status: 404 }
      )
    }

    // Update the vocabulary entry
    const { data: updatedWord, error: updateError } = await supabase
      .from('vocabulary')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating vocabulary:', updateError)
      return NextResponse.json(
        { error: 'Failed to update word', details: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      word: updatedWord,
    })
  } catch (error) {
    console.error('Error in vocabulary update API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
