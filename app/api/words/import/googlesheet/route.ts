import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getUserLLMConfig, LLMService } from '@/lib/llm/service'

// Helper function to extract Google Sheet ID from URL
function extractSheetId(url: string): string | null {
  const patterns = [
    /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
    /^([a-zA-Z0-9-_]+)$/, // Just the ID
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) {
      return match[1]
    }
  }

  return null
}

// Helper function to parse CSV data - accepts single column or multi-column
function parseCSV(csvText: string): Array<string> {
  const lines = csvText.trim().split('\n')
  const results: Array<string> = []

  // Common header keywords to skip
  const headerKeywords = ['word', 'translation', 'english', 'german', 'french', 'spanish', 'italian', 'portuguese', 'dutch', 'swedish', 'danish', 'norwegian', 'target', 'source', 'foreign', 'vokabel']

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue

    // Get the first column (the target language word)
    let word: string
    if (line.includes('\t')) {
      word = line.split('\t')[0]?.trim().replace(/^["']|["']$/g, '') || ''
    } else if (line.includes(';')) {
      word = line.split(';')[0]?.trim().replace(/^["']|["']$/g, '') || ''
    } else if (line.includes(',')) {
      word = line.split(',')[0]?.trim().replace(/^["']|["']$/g, '') || ''
    } else {
      // Single column - use the whole line
      word = line.trim().replace(/^["']|["']$/g, '')
    }

    // Skip if word is empty
    if (!word) {
      console.log(`Skipping line ${i + 1}: Empty word`)
      continue
    }

    // Skip likely header rows (first row with common header keywords)
    if (i === 0 && headerKeywords.some(keyword => word.toLowerCase().includes(keyword))) {
      console.log(`Skipping line ${i + 1}: Detected as header row (word: "${word}")`)
      continue
    }

    results.push(word)
  }

  return results
}

// Helper function to enrich a word using LLM
async function enrichWord(
  word: string,
  language: string,
  llmService: LLMService
): Promise<Record<string, unknown>> {
  try {
    const languageName = language.charAt(0).toUpperCase() + language.slice(1)

    const vocabResponse = await llmService.generateCompletion(
      [
        {
          role: 'user',
          content: `You are a ${languageName} language expert. Provide complete grammatical information for the ${languageName} word/phrase "${word}".

IMPORTANT: If the input word includes an article (like "die Absage" in German), extract ONLY the root word for "targetWord" (e.g., "Absage") and store the article separately in the "article" field (e.g., "die"). Never duplicate the article in the targetWord.

Return a JSON object with this structure (only include fields relevant to the word type):
{
  "type": "noun|verb|adjective|adverb|pronoun|article|preposition|conjunction|expression|collocation",
  "targetWord": "root word WITHOUT article",
  "english": ["translation1", "translation2"],
  "difficulty": "A1|A2|B1|B2|C1|C2",
  "article": "der|die|das" (nouns only, for German - extracted from input if present),
  "gender": "masculine|feminine|neuter" (nouns only),
  "plural": "plural form" (nouns only),
  "genitive": "genitive form" (nouns only, for German),
  "weak": true/false (nouns only, for German),
  "compound": {"isCompound": true/false, "components": []} (nouns only),
  "infinitive": "infinitive form" (verbs only),
  "auxiliary": "haben|sein" (verbs only, for German),
  "separable": {"isSeparable": true/false, "prefix": "", "stem": ""} (separable verbs, for German),
  "reflexive": {"isReflexive": true/false, "reflexiveCase": "accusative|dative"} (reflexive verbs),
  "transitivity": "transitive|intransitive|both" (verbs only),
  "conjugation": {
    "present": {"ich": "", "du": "", "er_sie_es": "", "wir": "", "ihr": "", "sie_Sie": ""},
    "preterite": {"ich": "", "du": "", "er_sie_es": "", "wir": "", "ihr": "", "sie_Sie": ""},
    "perfect": "past participle",
    "imperative": {"du": "", "ihr": "", "Sie": ""}
  } (verbs only, for German - adapt for other languages),
  "prepositionCase": [{"preposition": "auf", "case": "accusative"}] (verbs/adjectives with prepositions),
  "base": "base form" (adjectives only),
  "comparative": "comparative form" (adjectives/adverbs),
  "superlative": "superlative form" (adjectives/adverbs),
  "irregular": true/false (adjectives only),
  "predicativeOnly": true/false (adjectives only),
  "category": "time|place|manner|degree|frequency" (adverbs only),
  "pronounType": "personal|possessive|demonstrative|relative|interrogative|reflexive|indefinite" (pronouns only),
  "declension": {...} (pronouns/articles),
  "person": "first|second|third" (pronouns only),
  "number": "singular|plural" (pronouns only),
  "articleType": "definite|indefinite|negative" (articles only),
  "governsCase": ["accusative", "dative"] (prepositions),
  "twoWay": true/false (prepositions only),
  "contracted": [{"form": "am", "expanded": "an dem"}] (prepositions only),
  "conjunctionType": "coordinating|subordinating|correlative" (conjunctions only),
  "affectsWordOrder": true/false (conjunctions only),
  "correlativePair": "..." (conjunctions only),
  "literal": "literal translation" (expressions only),
  "register": "formal|informal|colloquial|slang|vulgar" (expressions only),
  "relatedWords": [...] (expressions only),
  "structure": "..." (collocations only),
  "components": [...] (collocations only),
  "strength": "strong|medium|weak" (collocations only),
  "alternative": "..." (collocations only),
  "notes": "usage notes",
  "examples": [{"${language}": "example sentence", "english": "translation"}]
}

Return ONLY valid JSON, no markdown formatting.`,
        },
      ],
      { maxTokens: 2048, model: 'fast' }
    )

    const cleanedText = vocabResponse.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(cleanedText)
  } catch (error) {
    console.error(`Error enriching word "${word}":`, error)
    // Return basic structure if enrichment fails
    return {
      type: 'noun',
      targetWord: word,
      english: [],
      difficulty: 'A1',
      notes: '',
      examples: [],
    }
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { googleSheetUrl, destination, listId, newListName, addToDictionary = true } = await request.json()

    if (!googleSheetUrl) {
      return NextResponse.json({ error: 'Google Sheet URL is required' }, { status: 400 })
    }

    // Extract sheet ID
    const sheetId = extractSheetId(googleSheetUrl)

    if (!sheetId) {
      return NextResponse.json({ error: 'Invalid Google Sheet URL' }, { status: 400 })
    }

    // Get user's target language and import delay setting
    const { data: profile } = await supabase
      .from('profiles')
      .select('target_language, import_delay_ms')
      .eq('id', user.id)
      .single()

    const targetLanguage = profile?.target_language || 'german'
    const importDelayMs = profile?.import_delay_ms || 1500 // Default to 1500ms (40 req/min)

    // Get LLM config for enrichment
    const llmConfig = await getUserLLMConfig(supabase, user.id)

    if (!llmConfig) {
      return NextResponse.json(
        { error: 'AI provider not configured. Please add an API key in your profile.' },
        { status: 400 }
      )
    }

    const llmService = new LLMService(llmConfig)

    // Fetch data from Google Sheet
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`

    console.log('=== Google Sheet Import Debug ===')
    console.log('Sheet ID:', sheetId)
    console.log('CSV URL:', csvUrl)

    let csvData: string
    try {
      const response = await fetch(csvUrl)
      console.log('Google Sheets response status:', response.status)
      console.log('Google Sheets response ok:', response.ok)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Google Sheets fetch error:', errorText)
        throw new Error(
          'Failed to fetch Google Sheet. Make sure the sheet is shared with "Anyone with the link can view".'
        )
      }
      csvData = await response.text()
      console.log('CSV data length:', csvData.length)
      console.log('CSV data preview (first 500 chars):', csvData.substring(0, 500))
      console.log('Total lines in CSV:', csvData.trim().split('\n').length)
    } catch (error) {
      console.error('=== Google Sheet Import Error ===')
      console.error('Error details:', error)
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : 'Failed to fetch Google Sheet',
        },
        { status: 400 }
      )
    }

    // Parse CSV
    const words = parseCSV(csvData)

    console.log('=== CSV Parsing Results ===')
    console.log('Words found:', words.length)
    console.log('First few words:', words.slice(0, 5))

    if (words.length === 0) {
      console.error('No valid words found in CSV data')
      return NextResponse.json({ error: 'No valid words found in Google Sheet' }, { status: 400 })
    }

    // Handle list creation if needed
    let targetListId = listId

    if (destination === 'new' && newListName) {
      const { data: newList, error: listError } = await supabase
        .from('word_lists')
        .insert({
          user_id: user.id,
          name: newListName,
          language: targetLanguage,
        })
        .select()
        .single()

      if (listError) throw listError
      targetListId = newList.id
    }

    // Validate existing list if specified
    if (destination === 'existing' && targetListId) {
      const { data: list } = await supabase
        .from('word_lists')
        .select('id')
        .eq('id', targetListId)
        .eq('user_id', user.id)
        .single()

      if (!list) {
        return NextResponse.json({ error: 'List not found or unauthorized' }, { status: 404 })
      }
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ word: string; error: string }>,
    }

    // Process each word
    for (const word of words) {
      try {
        // Check if word already exists in vocabulary
        const { data: existingVocab } = await supabase
          .from('vocabulary')
          .select('id')
          .eq('target_word', word)
          .eq('language', targetLanguage)
          .single()

        let vocabularyId = existingVocab?.id

        if (!existingVocab) {
          // Enrich the word
          console.log(`Enriching word: ${word}`)
          const enrichedData = await enrichWord(word, targetLanguage, llmService)

          // Normalize type
          const typeValue = enrichedData.type?.toString().toLowerCase() || 'noun'
          const normalizedType = typeValue.includes('|') ? typeValue.split('|')[0].trim() : typeValue

          vocabularyId = `${normalizedType.substring(0, 3)}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

          // Build vocabulary insert object
          const vocabInsert: Record<string, unknown> = {
            id: vocabularyId,
            type: normalizedType,
            language: targetLanguage,
            target_word: enrichedData.targetWord || word,
            english: enrichedData.english || [],
            difficulty: enrichedData.difficulty || 'A1',
            tags: [],
            examples: enrichedData.examples || [],
            notes: enrichedData.notes || '',
            audio_url: '',
            preposition_case: enrichedData.prepositionCase || null,
          }

          // Add type-specific fields
          if (normalizedType === 'noun') {
            vocabInsert.article = enrichedData.article
            vocabInsert.gender = enrichedData.gender
            vocabInsert.plural = enrichedData.plural
            vocabInsert.genitive = enrichedData.genitive
            vocabInsert.weak = enrichedData.weak
            vocabInsert.compound = enrichedData.compound
          } else if (normalizedType === 'verb') {
            vocabInsert.infinitive = enrichedData.infinitive
            vocabInsert.auxiliary = enrichedData.auxiliary
            vocabInsert.separable = enrichedData.separable
            vocabInsert.reflexive = enrichedData.reflexive
            vocabInsert.transitivity = enrichedData.transitivity
            vocabInsert.conjugation = enrichedData.conjugation
          } else if (normalizedType === 'adjective') {
            vocabInsert.base = enrichedData.base
            vocabInsert.comparative = enrichedData.comparative
            vocabInsert.superlative = enrichedData.superlative
            vocabInsert.irregular = enrichedData.irregular
            vocabInsert.predicative_only = enrichedData.predicativeOnly
          } else if (normalizedType === 'adverb') {
            vocabInsert.category = enrichedData.category
            vocabInsert.comparative = enrichedData.comparative
            vocabInsert.superlative = enrichedData.superlative
          } else if (normalizedType === 'pronoun') {
            vocabInsert.pronoun_type = enrichedData.pronounType
            vocabInsert.declension = enrichedData.declension
            vocabInsert.person = enrichedData.person
            vocabInsert.number = enrichedData.number
            vocabInsert.gender = enrichedData.gender
          } else if (normalizedType === 'article') {
            vocabInsert.article_type = enrichedData.articleType
            vocabInsert.declension = enrichedData.declension
          } else if (normalizedType === 'preposition') {
            vocabInsert.governs_case = enrichedData.governsCase
            vocabInsert.two_way = enrichedData.twoWay
            vocabInsert.contracted = enrichedData.contracted
          } else if (normalizedType === 'conjunction') {
            vocabInsert.conjunction_type = enrichedData.conjunctionType
            vocabInsert.affects_word_order = enrichedData.affectsWordOrder
            vocabInsert.correlative_pair = enrichedData.correlativePair
          } else if (normalizedType === 'expression') {
            vocabInsert.literal = enrichedData.literal
            vocabInsert.register = enrichedData.register
            vocabInsert.expression_category = enrichedData.category
            vocabInsert.related_words = enrichedData.relatedWords
          } else if (normalizedType === 'collocation') {
            vocabInsert.structure = enrichedData.structure
            vocabInsert.components = enrichedData.components
            vocabInsert.strength = enrichedData.strength
            vocabInsert.alternative = enrichedData.alternative
          }

          // Insert into vocabulary table
          const { error: vocabError } = await supabase.from('vocabulary').insert(vocabInsert)

          if (vocabError && !vocabError.message.includes('duplicate')) {
            throw vocabError
          }

          // Add delay to respect LLM API rate limits (configurable in user profile)
          await new Promise((resolve) => setTimeout(resolve, importDelayMs))
        }

        // Add to user_words if addToDictionary is true and not already present
        if (addToDictionary) {
          const { data: existingUserWord } = await supabase
            .from('user_words')
            .select('id')
            .eq('user_id', user.id)
            .eq('word_id', vocabularyId)
            .single()

          if (!existingUserWord) {
            await supabase.from('user_words').insert({
              user_id: user.id,
              word_id: vocabularyId,
              status: 'revising',
              priority_score: 80,
              ease_factor: 2.5,
              interval: 0,
              repetitions: 0,
              correct_count: 0,
              incorrect_count: 0,
              next_review_date: new Date().toISOString(),
            })
          }
        }

        // Add to list if destination is 'existing' or 'new'
        if ((destination === 'existing' || destination === 'new') && targetListId) {
          // Check if already in list
          const { data: existingItem } = await supabase
            .from('word_list_items')
            .select('id')
            .eq('list_id', targetListId)
            .eq('vocabulary_id', vocabularyId)
            .single()

          if (!existingItem) {
            await supabase.from('word_list_items').insert({
              list_id: targetListId,
              vocabulary_id: vocabularyId,
              added_by: user.id,
            })
          }
        }

        results.success++
      } catch (error) {
        console.error(`Error processing word "${word}":`, error)
        results.failed++
        results.errors.push({
          word,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return NextResponse.json({
      message: `Import completed: ${results.success} words imported, ${results.failed} failed`,
      results,
      listId: targetListId,
    })
  } catch (error) {
    console.error('Google Sheet import error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import Google Sheet' },
      { status: 500 }
    )
  }
}
