import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getUserLLMConfig, LLMService } from '@/lib/llm/service'

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

    const llmConfig = await getUserLLMConfig(supabase, user.id)

    if (!llmConfig) {
      return NextResponse.json(
        { error: 'AI provider not configured. Please add an API key in your profile.' },
        { status: 400 }
      )
    }

    const llmService = new LLMService(llmConfig)

    const response = await llmService.generateCompletion(
      [
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
      { maxTokens: 500, model: 'fast' }
    )

    const responseText = response.content
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
