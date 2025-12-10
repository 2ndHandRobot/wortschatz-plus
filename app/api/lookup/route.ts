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

    const { word } = await request.json()

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

    console.log(`Making request to ${llmConfig.provider} API...`)

    const rootFormResponse = await llmService.generateCompletion(
      [
        {
          role: 'user',
          content: `You are a German language expert. Given the German word or phrase "${word}", identify its root form (lemma). For verbs in conjugated forms, return the infinitive. For nouns in plural, return the singular WITHOUT article. For adjectives in declined forms, return the base form. For common collocations, expressions, or idioms, return the full phrase.

Return ONLY the root form, nothing else. Examples:
- "ging" -> "gehen"
- "Tische" -> "Tisch"
- "der Tisch" -> "Tisch"
- "guten" -> "gut"
- "Entscheidung treffen" -> "Entscheidung treffen"`,
        },
      ],
      { maxTokens: 1024, model: 'fast' }
    )

    const rootForm = rootFormResponse.content.trim()

    const { data: vocabularyEntry } = await supabase
      .from('vocabulary')
      .select('*')
      .eq('german', rootForm)
      .single()

    if (vocabularyEntry) {
      return NextResponse.json({
        rootForm,
        entry: vocabularyEntry,
        source: 'database',
      })
    }

    const vocabResponse = await llmService.generateCompletion(
      [
        {
          role: 'user',
          content: `You are a German language expert. Provide complete grammatical information for the German word/phrase "${rootForm}".

Return a JSON object with this structure (only include fields relevant to the word type):
{
  "type": "noun|verb|adjective|adverb|pronoun|article|preposition|conjunction|expression|collocation",
  "german": "${rootForm}",
  "english": ["translation1", "translation2"],
  "difficulty": "A1|A2|B1|B2|C1|C2",
  "article": "der|die|das" (nouns only),
  "gender": "masculine|feminine|neuter" (nouns only),
  "plural": "plural form" (nouns only),
  "infinitive": "infinitive form" (verbs only),
  "auxiliary": "haben|sein" (verbs only),
  "separable": {"isSeparable": true/false, "prefix": "", "stem": ""} (separable verbs),
  "conjugation": {
    "present": {"ich": "", "du": "", "er_sie_es": ""},
    "preterite": {"ich": "", "du": "", "er_sie_es": ""},
    "perfect": "past participle"
  } (verbs only),
  "prepositionCase": [{"preposition": "auf", "case": "accusative"}] (verbs/adjectives with prepositions),
  "comparative": "comparative form" (adjectives/adverbs),
  "superlative": "superlative form" (adjectives/adverbs),
  "governsCase": ["accusative", "dative"] (prepositions),
  "notes": "usage notes",
  "examples": [{"german": "example sentence", "english": "translation"}]
}

Return ONLY valid JSON, no markdown formatting.`,
        },
      ],
      { maxTokens: 2048, model: 'fast' }
    )

    const cleanedText = vocabResponse.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const vocabData = JSON.parse(cleanedText)

    return NextResponse.json({
      rootForm,
      entry: vocabData,
      source: 'llm',
    })
  } catch (error) {
    console.error('Lookup error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to look up word'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
