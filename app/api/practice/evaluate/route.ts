import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userTranslation, correctTranslation, englishPrompt } = await request.json()

    if (!userTranslation || !correctTranslation || !englishPrompt) {
      return NextResponse.json(
        { error: 'User translation, correct translation, and English prompt are required' },
        { status: 400 }
      )
    }

    // Get user's Claude API key
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('claude_api_key')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.claude_api_key) {
      return NextResponse.json(
        { error: 'Claude API key not found. Please add it in your profile.' },
        { status: 400 }
      )
    }

    // Use Claude to evaluate the translation
    const anthropic = new Anthropic({
      apiKey: profile.claude_api_key.trim(),
    })

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: `You are a German language teacher evaluating student translations.

English prompt: "${englishPrompt}"
Correct German translation: "${correctTranslation}"
Student's German translation: "${userTranslation}"

Evaluate if the student's translation is correct or acceptable. Consider:
1. Grammatical correctness
2. Meaning accuracy
3. Natural German phrasing
4. Minor variations that are still correct

Respond in JSON format:
{
  "isCorrect": true/false,
  "feedback": "Brief explanation of what was good or what needs improvement"
}

Be encouraging but accurate. Accept minor variations if they're grammatically correct and convey the same meaning.`,
        },
      ],
    })

    const content = message.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude')
    }

    // Parse Claude's response
    const responseText = content.text
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)

    if (!jsonMatch) {
      throw new Error('Could not parse Claude response')
    }

    const evaluation = JSON.parse(jsonMatch[0])

    return NextResponse.json({
      isCorrect: evaluation.isCorrect,
      feedback: evaluation.feedback,
    })
  } catch (error) {
    console.error('Evaluate translation error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      {
        error: 'Failed to evaluate translation',
        details: errorMessage
      },
      { status: 500 }
    )
  }
}
