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

    const { word } = await request.json()

    if (!word) {
      return NextResponse.json({ error: 'Word is required' }, { status: 400 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('claude_api_key')
      .eq('id', user.id)
      .single()

    // console.log('Profile data:', profile)
    // console.log('API key exists:', !!profile?.claude_api_key)
    // console.log('API key length:', profile?.claude_api_key?.length)

    if (!profile?.claude_api_key) {
      return NextResponse.json(
        { error: 'Claude API key not configured. Please add it in your profile.' },
        { status: 400 }
      )
    }

    const anthropic = new Anthropic({
      apiKey: profile.claude_api_key.trim(),
    })

    console.log('Making request to Claude API...')
    console.log('API key prefix:', profile.claude_api_key.trim().substring(0, 10) + '...')

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
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
    })

    const rootForm = message.content[0].type === 'text' ? message.content[0].text.trim() : word

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

    const vocabMessage = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [
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
    })

    const vocabText = vocabMessage.content[0].type === 'text' ? vocabMessage.content[0].text : '{}'
    const cleanedText = vocabText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
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
