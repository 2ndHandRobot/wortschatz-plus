import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('claude_api_key')
      .eq('id', user.id)
      .single()

    if (!profile?.claude_api_key) {
      return NextResponse.json(
        { error: 'Claude API key not configured' },
        { status: 400 }
      )
    }

    const apiKey = profile.claude_api_key.trim()

    console.log('=== Claude API Test ===')
    console.log('API Key prefix:', apiKey.substring(0, 20) + '...')
    console.log('API Key length:', apiKey.length)
    console.log('Making test request to Claude API...')

    const anthropic = new Anthropic({
      apiKey: apiKey,
    })

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 50,
      messages: [
        {
          role: 'user',
          content: 'Say "Hello" in one word.',
        },
      ],
    })

    console.log('Success! Response received from Claude')

    const responseText = message.content[0].type === 'text' ? message.content[0].text : 'No text response'

    return NextResponse.json({
      success: true,
      message: 'Claude API is working!',
      response: responseText,
      apiKeyPrefix: apiKey.substring(0, 20) + '...',
      model: message.model,
      usage: message.usage,
    })
  } catch (error) {
    console.error('=== Claude API Test Error ===')
    console.error('Error type:', error?.constructor?.name)
    console.error('Error message:', error instanceof Error ? error.message : String(error))
    console.error('Full error:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorType: error?.constructor?.name,
      },
      { status: 500 }
    )
  }
}
