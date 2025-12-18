import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST - Add a word to user's dictionary by vocabularyId
export async function POST(request: Request) {
  try {
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

    // Check if word already exists in user's dictionary
    const { data: existingWord } = await supabase
      .from('user_words')
      .select('id')
      .eq('user_id', user.id)
      .eq('word_id', vocabularyId)
      .single()

    if (existingWord) {
      return NextResponse.json(
        { error: 'Word already in your dictionary' },
        { status: 400 }
      )
    }

    // Add word to user's dictionary
    const { data: newUserWord, error: insertError } = await supabase
      .from('user_words')
      .insert({
        user_id: user.id,
        word_id: vocabularyId,
        status: 'revising',
        priority_score: 80,
        ease_factor: 2.5,
        interval: 0,
        repetitions: 0,
        correct_count: 0,
        incorrect_count: 0,
        next_review_date: new Date().toISOString(),
      })
      .select()
      .single()

    if (insertError) throw insertError

    return NextResponse.json({
      message: 'Word added to your dictionary',
      userWord: newUserWord,
    })
  } catch (error) {
    console.error('Add word to dictionary error:', error)
    return NextResponse.json(
      { error: 'Failed to add word to dictionary' },
      { status: 500 }
    )
  }
}
