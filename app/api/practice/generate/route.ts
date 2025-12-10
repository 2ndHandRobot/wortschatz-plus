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

    const { word, type, difficulty, english } = await request.json()

    if (!word) {
      return NextResponse.json({ error: 'Word is required' }, { status: 400 })
    }

    const llmConfig = await getUserLLMConfig(supabase, user.id)

    if (!llmConfig) {
      return NextResponse.json(
        { error: 'AI provider not configured. Please add an API key in your profile.' },
        { status: 400 }
      )
    }

    const llmService = new LLMService(llmConfig)

    const englishTranslations = Array.isArray(english) ? english.join(', ') : english

    const prompt = `Create a natural English sentence that, when translated to German, would use the word "${word}".

Context:
- German word: ${word}
- English meaning: ${englishTranslations}
- Word type: ${type}
- Difficulty level: ${difficulty}

The sentence should be appropriate for a ${difficulty} German learner and naturally use the word in context.

Return a JSON object with this structure:
{
  "sentenceEnglish": "The English sentence",
  "sentenceGerman": "Die deutsche Übersetzung"
}

Return ONLY valid JSON, no markdown.`

    const response = await llmService.generateCompletion(
      [
        {
          role: 'user',
          content: prompt,
        },
      ],
      { maxTokens: 512, model: 'fast' }
    )

    const cleanedText = response.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const exerciseData = JSON.parse(cleanedText)

    return NextResponse.json({
      sentenceGerman: exerciseData.sentenceGerman,
      sentenceEnglish: exerciseData.sentenceEnglish
    })
  } catch (error) {
    console.error('Practice generation error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate practice exercise'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
