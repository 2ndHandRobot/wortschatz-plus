import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { calculateNextReview, determineStatusChange, calculatePriorityScore } from '@/lib/spaced-repetition'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sessionId, userWordId, mode, correct, attempts = 1 } = await request.json()

    if (!sessionId || !userWordId || !mode || correct === undefined) {
      return NextResponse.json(
        { error: 'Session ID, user word ID, mode, and correct status are required' },
        { status: 400 }
      )
    }

    // Get current user word data
    const { data: userWord, error: fetchError } = await supabase
      .from('user_words')
      .select('*')
      .eq('id', userWordId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !userWord) {
      return NextResponse.json(
        { error: 'User word not found' },
        { status: 404 }
      )
    }

    // Record session item
    const { error: recordError } = await supabase
      .from('session_items')
      .insert({
        session_id: sessionId,
        user_word_id: userWordId,
        mode,
        correct,
        attempts,
        practiced_at: new Date().toISOString(),
      })

    if (recordError) throw recordError

    // Calculate next review using spaced repetition algorithm
    const nextReview = calculateNextReview({
      correct,
      attempts,
      previousEaseFactor: userWord.ease_factor,
      previousInterval: userWord.interval,
      previousRepetitions: userWord.repetitions,
    })

    // Update counts
    const newCorrectCount = correct ? userWord.correct_count + 1 : userWord.correct_count
    const newIncorrectCount = correct ? userWord.incorrect_count : userWord.incorrect_count + 1

    // Prepare updated word data
    const updatedWordData: Record<string, any> = {
      ease_factor: nextReview.easeFactor,
      interval: nextReview.interval,
      repetitions: nextReview.repetitions,
      next_review_date: nextReview.nextReviewDate,
      correct_count: newCorrectCount,
      incorrect_count: newIncorrectCount,
      last_practiced: new Date().toISOString(),
    }

    // Add mode-specific timestamps
    if (mode === 'revise') {
      updatedWordData.last_revised = new Date().toISOString()
    } else if (mode === 'recall') {
      updatedWordData.last_recalled = new Date().toISOString()
    }

    // Check if status should change
    const newStatus = determineStatusChange({
      status: userWord.status,
      repetitions: nextReview.repetitions,
      easeFactor: nextReview.easeFactor,
      correctCount: newCorrectCount,
      incorrectCount: newIncorrectCount,
    })

    if (newStatus) {
      updatedWordData.status = newStatus
    }

    // Calculate new priority score
    const priorityScore = calculatePriorityScore({
      status: newStatus || userWord.status,
      nextReviewDate: nextReview.nextReviewDate,
      easeFactor: nextReview.easeFactor,
      repetitions: nextReview.repetitions,
      incorrectCount: newIncorrectCount,
      correctCount: newCorrectCount,
      lastPracticed: new Date().toISOString(),
      addedAt: userWord.added_at,
    })

    updatedWordData.priority_score = priorityScore

    // Update user word
    const { data: updated, error: updateError } = await supabase
      .from('user_words')
      .update(updatedWordData)
      .eq('id', userWordId)
      .select()
      .single()

    if (updateError) throw updateError

    return NextResponse.json({
      success: true,
      userWord: updated,
      statusChanged: newStatus !== null,
      newStatus: newStatus || userWord.status,
    })
  } catch (error) {
    console.error('Record session item error:', error)
    return NextResponse.json(
      { error: 'Failed to record session item' },
      { status: 500 }
    )
  }
}
