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

    const { userTranslation, correctTranslation, englishPrompt, targetWord } = await request.json()

    if (!userTranslation || !correctTranslation || !englishPrompt || !targetWord) {
      return NextResponse.json(
        { error: 'User translation, correct translation, English prompt, and target word are required' },
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
          content: `You are a German language teacher evaluating student translations in a vocabulary practice exercise.

English prompt: "${englishPrompt}"
Student's German translation: "${userTranslation}"
TARGET WORD being practiced: "${targetWord}"

EVALUATION CRITERIA:
The exercise focuses specifically on the target word "${targetWord}". Evaluate the student's translation and assign one of three outcomes:

1. "correct" - Good answer:
   - The target word "${targetWord}" is used correctly (right form, right grammar, right collocations, correct prepositions)
   - The meaning of the English prompt is accurately conveyed
   - Only minor errors (if any) in other parts of the sentence (e.g., small typos, minor word order issues that don't affect meaning)

2. "improve" - Could be improved:
   - The target word "${targetWord}" is used correctly
   - BUT there is at least one major mistake in other parts of the sentence (e.g., wrong verb conjugation, wrong case for other words, missing words, incorrect word choice)
   - The overall meaning is still somewhat clear despite the errors

3. "incorrect" - Incorrect:
   - The target word "${targetWord}" is used incorrectly, missing, or has errors
   - This includes: wrong form, wrong tense, wrong case, wrong article, wrong preposition that collocates with the target word
   - OR the translation fails to convey the meaning of the English prompt

For your feedback:
- For "correct": Be encouraging and highlight what was done well
- For "improve": Acknowledge correct use of the target word, then point out the specific errors in other parts: "Good use of '${targetWord}'! However, [specific issue with other part]..."
- For "incorrect": Focus on what's wrong with the target word specifically or why the meaning is not conveyed

Respond in JSON format:
{
  "outcome": "correct" | "improve" | "incorrect",
  "feedback": "Brief explanation (1-2 sentences)"
}`,
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
      outcome: evaluation.outcome,
      feedback: evaluation.feedback,
      suggestedTranslation: correctTranslation,
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
