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

    const llmConfig = await getUserLLMConfig(supabase, user.id)

    if (!llmConfig) {
      return NextResponse.json(
        { error: 'AI provider not configured. Please add an API key in your profile.' },
        { status: 400 }
      )
    }

    const { wordId, force } = await request.json()

    // Get user's target language
    const { data: profile } = await supabase
      .from('profiles')
      .select('target_language')
      .eq('id', user.id)
      .single()

    const targetLanguage = profile?.target_language || 'german'

    // If wordId is provided, enrich only that word, otherwise enrich all incomplete words
    let query = supabase.from('vocabulary').select('*').eq('language', targetLanguage)

    if (wordId) {
      query = query.eq('id', wordId)
    } else {
      // Find words with missing examples or notes (indicators of incomplete data)
      query = query.or('examples.eq.[],notes.is.null,notes.eq.')
    }

    const { data: vocabularyEntries, error: fetchError } = await query

    if (fetchError) {
      throw fetchError
    }

    if (!vocabularyEntries || vocabularyEntries.length === 0) {
      return NextResponse.json({
        message: 'No incomplete vocabulary entries found',
        enriched: 0,
      })
    }

    const llmService = new LLMService(llmConfig)

    let enrichedCount = 0
    const errors: Array<{ word: string; error: string }> = []

    for (const entry of vocabularyEntries) {
      // Skip if entry already has examples and notes (unless force is true)
      if (!force && entry.examples && entry.examples.length > 0 && entry.notes) {
        continue
      }

      try {
        console.log(`Enriching word: ${entry.target_word}`)

        const languageName = targetLanguage.charAt(0).toUpperCase() + targetLanguage.slice(1)

        const vocabResponse = await llmService.generateCompletion(
          [
            {
              role: 'user',
              content: `You are a ${languageName} language expert. Provide complete grammatical information for the ${languageName} word/phrase "${entry.target_word}".

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
  "examples": [{"${targetLanguage}": "example sentence", "english": "translation"}]
}

Return ONLY valid JSON, no markdown formatting.`,
            },
          ],
          { maxTokens: 2048, model: 'fast' }
        )

        const cleanedText = vocabResponse.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        const vocabData = JSON.parse(cleanedText)

        // Build update object with all relevant fields
        const updateData: Record<string, unknown> = {
          examples: vocabData.examples || entry.examples || [],
          notes: vocabData.notes || entry.notes || '',
          difficulty: vocabData.difficulty || entry.difficulty,
          preposition_case: vocabData.prepositionCase || entry.preposition_case || null,
        }

        // Update type-specific fields based on the word type
        if (entry.type === 'noun') {
          updateData.article = vocabData.article || entry.article
          updateData.gender = vocabData.gender || entry.gender
          updateData.plural = vocabData.plural || entry.plural
          updateData.genitive = vocabData.genitive || entry.genitive
          updateData.weak = vocabData.weak ?? entry.weak
          updateData.compound = vocabData.compound || entry.compound
        } else if (entry.type === 'verb') {
          updateData.infinitive = vocabData.infinitive || entry.infinitive
          updateData.auxiliary = vocabData.auxiliary || entry.auxiliary
          updateData.separable = vocabData.separable || entry.separable
          updateData.reflexive = vocabData.reflexive || entry.reflexive
          updateData.transitivity = vocabData.transitivity || entry.transitivity
          updateData.conjugation = vocabData.conjugation || entry.conjugation
        } else if (entry.type === 'adjective') {
          updateData.base = vocabData.base || entry.base
          updateData.comparative = vocabData.comparative || entry.comparative
          updateData.superlative = vocabData.superlative || entry.superlative
          updateData.irregular = vocabData.irregular ?? entry.irregular
          updateData.predicative_only = vocabData.predicativeOnly ?? entry.predicative_only
        } else if (entry.type === 'adverb') {
          updateData.category = vocabData.category || entry.category
          updateData.comparative = vocabData.comparative || entry.comparative
          updateData.superlative = vocabData.superlative || entry.superlative
        } else if (entry.type === 'pronoun') {
          updateData.pronoun_type = vocabData.pronounType || entry.pronoun_type
          updateData.declension = vocabData.declension || entry.declension
          updateData.person = vocabData.person || entry.person
          updateData.number = vocabData.number || entry.number
          updateData.gender = vocabData.gender || entry.gender
        } else if (entry.type === 'article') {
          updateData.article_type = vocabData.articleType || entry.article_type
          updateData.declension = vocabData.declension || entry.declension
        } else if (entry.type === 'preposition') {
          updateData.governs_case = vocabData.governsCase || entry.governs_case
          updateData.two_way = vocabData.twoWay ?? entry.two_way
          updateData.contracted = vocabData.contracted || entry.contracted
        } else if (entry.type === 'conjunction') {
          updateData.conjunction_type = vocabData.conjunctionType || entry.conjunction_type
          updateData.affects_word_order = vocabData.affectsWordOrder ?? entry.affects_word_order
          updateData.correlative_pair = vocabData.correlativePair || entry.correlative_pair
        } else if (entry.type === 'expression') {
          updateData.literal = vocabData.literal || entry.literal
          updateData.register = vocabData.register || entry.register
          updateData.expression_category = vocabData.category || entry.expression_category
          updateData.related_words = vocabData.relatedWords || entry.related_words
        } else if (entry.type === 'collocation') {
          updateData.structure = vocabData.structure || entry.structure
          updateData.components = vocabData.components || entry.components
          updateData.strength = vocabData.strength || entry.strength
          updateData.alternative = vocabData.alternative || entry.alternative
        }

        const { error: updateError } = await supabase
          .from('vocabulary')
          .update(updateData)
          .eq('id', entry.id)

        if (updateError) {
          throw updateError
        }

        enrichedCount++
        console.log(`Successfully enriched: ${entry.target_word}`)

        // Add a small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 500))
      } catch (error) {
        console.error(`Error enriching ${entry.target_word}:`, error)
        errors.push({
          word: entry.target_word,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return NextResponse.json({
      message: `Enriched ${enrichedCount} vocabulary entries`,
      enriched: enrichedCount,
      total: vocabularyEntries.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Enrich vocabulary error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to enrich vocabulary'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
