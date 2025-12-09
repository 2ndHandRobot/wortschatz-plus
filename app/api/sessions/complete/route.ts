import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sessionId } = await request.json()

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    // Get session data
    const { data: session, error: fetchError } = await supabase
      .from('learning_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // Calculate duration
    const startedAt = new Date(session.started_at)
    const completedAt = new Date()
    const durationSeconds = Math.floor((completedAt.getTime() - startedAt.getTime()) / 1000)

    // Update session with completion data
    const { data: updated, error: updateError } = await supabase
      .from('learning_sessions')
      .update({
        completed_at: completedAt.toISOString(),
        duration_seconds: durationSeconds,
      })
      .eq('id', sessionId)
      .select()
      .single()

    if (updateError) throw updateError

    return NextResponse.json({
      success: true,
      session: updated,
      durationSeconds,
    })
  } catch (error) {
    console.error('Complete session error:', error)
    return NextResponse.json(
      { error: 'Failed to complete session' },
      { status: 500 }
    )
  }
}
