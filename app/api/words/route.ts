import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET - Fetch all words in user's dictionary
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userWords, error } = await supabase
      .from('user_words')
      .select('*')
      .eq('user_id', user.id)

    if (error) throw error

    return NextResponse.json({ words: userWords })
  } catch (error) {
    console.error('Fetch user words error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user words' },
      { status: 500 }
    )
  }
}

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
      .select('*')
      .eq('user_id', user.id)
      .eq('word_id', vocabularyId)
      .single()

    if (existingWord) {
      // Word already exists, increase priority
      const newPriorityScore = Math.min(existingWord.priority_score + 10, 100)

      const { data: updated, error: updateError } = await supabase
        .from('user_words')
        .update({
          priority_score: newPriorityScore,
          status: existingWord.status === 'mastered' ? 'recalling' : existingWord.status,
        })
        .eq('id', existingWord.id)
        .select()
        .single()

      if (updateError) throw updateError

      return NextResponse.json({
        message: 'Word priority increased',
        userWord: updated,
        isNew: false,
      })
    }

    // Verify the vocabulary exists
    const { data: vocabExists, error: vocabError } = await supabase
      .from('vocabulary')
      .select('id')
      .eq('id', vocabularyId)
      .single()

    if (vocabError || !vocabExists) {
      console.error('Vocabulary not found:', vocabularyId, vocabError)
      return NextResponse.json(
        { error: 'Vocabulary word not found' },
        { status: 404 }
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

    if (insertError) {
      console.error('Insert error:', insertError)
      throw insertError
    }

    return NextResponse.json({
      message: 'Word added to your dictionary',
      userWord: newUserWord,
      isNew: true,
    })
  } catch (error) {
    console.error('Add word to dictionary error:', error)
    return NextResponse.json(
      { error: 'Failed to add word to dictionary', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
