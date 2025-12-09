import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
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

    const { id: sessionId } = await params

    // Get session data
    const { data: session, error: sessionError } = await supabase
      .from('learning_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // Get session items
    const { data: items, error: itemsError } = await supabase
      .from('session_items')
      .select('*')
      .eq('session_id', sessionId)

    if (itemsError) throw itemsError

    // Calculate statistics
    const totalItems = items?.length || 0
    const correctItems = items?.filter(item => item.correct).length || 0
    const incorrectItems = totalItems - correctItems

    // Get status changes (simplified - you could track this more precisely)
    // For now, we'll estimate based on the performance
    const wordsMovedUp = Math.floor(correctItems * 0.3) // Estimate
    const wordsMovedDown = Math.floor(incorrectItems * 0.2) // Estimate

    const stats = {
      sessionType: session.session_type,
      mode: items?.[0]?.mode || 'revise', // Get mode from first item
      totalItems,
      correctItems,
      incorrectItems,
      durationSeconds: session.duration_seconds || 0,
      startedAt: session.started_at,
      completedAt: session.completed_at || new Date().toISOString(),
      wordsMovedUp,
      wordsMovedDown,
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Get session stats error:', error)
    return NextResponse.json(
      { error: 'Failed to get session stats' },
      { status: 500 }
    )
  }
}
