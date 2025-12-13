import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const userWordId = id

    if (!userWordId) {
      return NextResponse.json({ error: 'Word ID is required' }, { status: 400 })
    }

    // Verify the word belongs to the user before attempting deletion
    const { data: userWord, error: fetchError } = await supabase
      .from('user_words')
      .select('id, word_id, vocabulary(target_word)')
      .eq('id', userWordId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !userWord) {
      console.error('Failed to find user word:', fetchError)
      return NextResponse.json(
        { error: 'Word not found in your dictionary' },
        { status: 404 }
      )
    }

    // Delete the user_word entry (RLS policy ensures user can only delete their own)
    const { error: deleteError } = await supabase
      .from('user_words')
      .delete()
      .eq('id', userWordId)
      .eq('user_id', user.id)

    if (deleteError) {
      throw deleteError
    }

    return NextResponse.json({
      message: 'Word removed from your dictionary',
      deletedWord: userWord,
    })
  } catch (error) {
    console.error('Delete word error:', error)
    return NextResponse.json(
      { error: 'Failed to remove word from dictionary' },
      { status: 500 }
    )
  }
}
