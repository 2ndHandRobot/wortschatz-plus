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

    const { word, type, difficulty, english, apiKey } = await request.json()

    if (!word) {
      return NextResponse.json({ error: 'Word is required' }, { status: 400 })
    }

    // Use provided apiKey or fetch from profile
    let claudeApiKey = apiKey

    if (!claudeApiKey) {
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
      claudeApiKey = profile.claude_api_key
    }

    const anthropic = new Anthropic({
      apiKey: claudeApiKey.trim(),
    })

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

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '{}'
    const cleanedText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
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
