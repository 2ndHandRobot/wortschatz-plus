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

    // Check if profile already exists
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single()

    if (existing) {
      return NextResponse.json({ message: 'Profile already exists' })
    }

    // Create profile
    const { error } = await supabase.from('profiles').insert({
      id: user.id,
      email: user.email || '',
      target_daily_learning_time: 15,
    })

    if (error) throw error

    return NextResponse.json({ message: 'Profile created successfully' })
  } catch (error) {
    console.error('Profile creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create profile' },
      { status: 500 }
    )
  }
}
