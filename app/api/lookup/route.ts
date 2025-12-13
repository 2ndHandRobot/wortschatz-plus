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

    // Get user's target language first
    const { data: profile } = await supabase
      .from('profiles')
      .select('target_language')
      .eq('id', user.id)
      .single()

    const targetLanguage = profile?.target_language || 'german'
    const languageNames: Record<string, string> = {
      german: 'German',
      french: 'French',
      spanish: 'Spanish',
      italian: 'Italian',
      portuguese: 'Portuguese',
      dutch: 'Dutch',
      swedish: 'Swedish',
      danish: 'Danish',
      norwegian: 'Norwegian',
    }
    const languageName = languageNames[targetLanguage] || 'German'

    const llmService = new LLMService(llmConfig)

    console.log(`Making request to ${llmConfig.provider} API for ${languageName}...`)

    const rootFormResponse = await llmService.generateCompletion(
      [
        {
          role: 'user',
          content: `You are a ${languageName} language expert. Given the ${languageName} word or phrase "${word}", identify its root form (lemma). For verbs in conjugated forms, return the infinitive. For nouns in plural, return the singular WITHOUT article. For adjectives in declined forms, return the base form. For common collocations, expressions, or idioms, return the full phrase.

Return ONLY the root form, nothing else.`,
        },
      ],
      { maxTokens: 1024, model: 'fast' }
    )

    const rootForm = rootFormResponse.content.trim()

    const { data: vocabularyEntry } = await supabase
      .from('vocabulary')
      .select('*')
      .eq('target_word', rootForm)
      .eq('language', targetLanguage)
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
          content: `You are a ${languageName} language expert. Provide complete grammatical information for the ${languageName} word/phrase "${rootForm}".

Return a JSON object with this structure (only include fields relevant to the word type):

IMPORTANT: The "type" field must be a SINGLE value. If the word can function as multiple parts of speech (e.g., both verb and noun), choose the PRIMARY or MOST COMMON usage. Include information about secondary forms in the notes field.

{
  "type": "noun|verb|adjective|adverb|pronoun|article|preposition|conjunction|expression|collocation",
  "targetWord": "${rootForm}",
  "english": ["translation1", "translation2"],
  "difficulty": "A1|A2|B1|B2|C1|C2",
  "article": "article if applicable" (nouns only - e.g., "der/die/das" for German, "le/la" for French),
  "gender": "masculine|feminine|neuter" (nouns only, if applicable to language),
  "plural": "plural form" (nouns only),
  "infinitive": "infinitive form" (verbs only),
  "auxiliary": "auxiliary verb" (verbs only - e.g., "haben/sein" for German, "avoir/être" for French),
  "separable": {"isSeparable": true/false, "prefix": "", "stem": ""} (separable verbs if applicable),
  "conjugation": {
    "present": {"ich": "", "du": "", "er_sie_es": ""},
    "preterite": {"ich": "", "du": "", "er_sie_es": ""},
    "perfect": "past participle"
  } (verbs only),
  "prepositionCase": [{"preposition": "preposition", "case": "case"}] (verbs/adjectives with prepositions),
  "comparative": "comparative form" (adjectives/adverbs),
  "superlative": "superlative form" (adjectives/adverbs),
  "governsCase": ["accusative", "dative"] (prepositions if applicable),
  "notes": "usage notes",
  "examples": [
    {
      "sentence": "A complete sentence in ${languageName}",
      "english": "English translation"
    },
    {
      "sentence": "Another complete sentence in ${languageName}",
      "english": "English translation"
    }
  ]
}

CRITICAL: For the "examples" array:
- The "sentence" field MUST contain full sentences in ${languageName} (the target language)
- For French, provide French sentences; for Spanish, Spanish sentences, etc.
- The "english" field should contain the English translation of that sentence
Return ONLY valid JSON, no markdown formatting.`,
        },
      ],
      { maxTokens: 2048, model: 'fast' }
    )

    const cleanedText = vocabResponse.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    // Log the LLM response for debugging
    console.log('=== LLM Vocabulary Response ===')
    console.log('Language:', languageName)
    console.log('Word:', rootForm)
    console.log('Raw Response:', cleanedText)
    console.log('================================')

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
