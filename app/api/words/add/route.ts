import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { wordData, source } = await request.json()

    if (!wordData) {
      return NextResponse.json({ error: 'Word data is required' }, { status: 400 })
    }

    // Get user's target language
    const { data: profile } = await supabase
      .from('profiles')
      .select('target_language')
      .eq('id', user.id)
      .single()

    const targetLanguage = profile?.target_language || 'german'

    let wordId = wordData.id

    if (source === 'llm' || !wordId) {
      // Log the word data for debugging
      console.log('=== Adding Word to Database ===')
      console.log('Source:', source)
      console.log('Word type:', wordData.type)
      console.log('Target language:', targetLanguage)
      console.log('Full wordData:', JSON.stringify(wordData, null, 2))
      console.log('================================')

      // Normalize the type to lowercase to match database constraints
      // If the LLM returns multiple types (e.g., "verb|noun"), take the first one
      const typeValue = wordData.type?.toLowerCase() || 'noun'
      const normalizedType = typeValue.includes('|') ? typeValue.split('|')[0].trim() : typeValue

      wordId = `${normalizedType.substring(0, 3)}-${Date.now()}`

      const vocabInsert: Record<string, unknown> = {
        id: wordId,
        type: normalizedType,
        language: targetLanguage,
        target_word: wordData.targetWord || wordData.german, // Support both new and legacy field names
        english: wordData.english,
        difficulty: wordData.difficulty,
        tags: wordData.tags || [],
        examples: wordData.examples || [],
        notes: wordData.notes || '',
        audio_url: wordData.audioUrl || '',
        preposition_case: wordData.prepositionCase || null,
      }

      if (normalizedType === 'noun') {
        vocabInsert.article = wordData.article
        vocabInsert.gender = wordData.gender
        vocabInsert.plural = wordData.plural
        vocabInsert.genitive = wordData.genitive
        vocabInsert.weak = wordData.weak
        vocabInsert.compound = wordData.compound
      } else if (normalizedType === 'verb') {
        vocabInsert.infinitive = wordData.infinitive
        vocabInsert.auxiliary = wordData.auxiliary
        vocabInsert.separable = wordData.separable
        vocabInsert.reflexive = wordData.reflexive
        vocabInsert.transitivity = wordData.transitivity
        vocabInsert.conjugation = wordData.conjugation
      } else if (normalizedType === 'adjective') {
        vocabInsert.base = wordData.base
        vocabInsert.comparative = wordData.comparative
        vocabInsert.superlative = wordData.superlative
        vocabInsert.irregular = wordData.irregular
        vocabInsert.predicative_only = wordData.predicativeOnly
      } else if (normalizedType === 'adverb') {
        vocabInsert.category = wordData.category
        vocabInsert.comparative = wordData.comparative
        vocabInsert.superlative = wordData.superlative
      } else if (normalizedType === 'pronoun') {
        vocabInsert.pronoun_type = wordData.pronounType
        vocabInsert.declension = wordData.declension
        vocabInsert.person = wordData.person
        vocabInsert.number = wordData.number
        vocabInsert.gender = wordData.gender
      } else if (normalizedType === 'article') {
        vocabInsert.article_type = wordData.articleType
        vocabInsert.declension = wordData.declension
      } else if (normalizedType === 'preposition') {
        vocabInsert.governs_case = wordData.governsCase
        vocabInsert.two_way = wordData.twoWay
        vocabInsert.contracted = wordData.contracted
      } else if (normalizedType === 'conjunction') {
        vocabInsert.conjunction_type = wordData.conjunctionType
        vocabInsert.affects_word_order = wordData.affectsWordOrder
        vocabInsert.correlative_pair = wordData.correlativePair
      } else if (normalizedType === 'expression') {
        vocabInsert.literal = wordData.literal
        vocabInsert.register = wordData.register
        vocabInsert.expression_category = wordData.category
        vocabInsert.related_words = wordData.relatedWords
      } else if (normalizedType === 'collocation') {
        vocabInsert.structure = wordData.structure
        vocabInsert.components = wordData.components
        vocabInsert.strength = wordData.strength
        vocabInsert.alternative = wordData.alternative
      }

      const { error: vocabError } = await supabase.from('vocabulary').insert(vocabInsert)

      if (vocabError && !vocabError.message.includes('duplicate')) {
        throw vocabError
      }
    }

    const { data: existingWord } = await supabase
      .from('user_words')
      .select('*')
      .eq('user_id', user.id)
      .eq('word_id', wordId)
      .single()

    if (existingWord) {
      const newPriorityScore = Math.min(existingWord.priority_score + 10, 100)

      const { data: updated, error: updateError } = await supabase
        .from('user_words')
        .update({
          priority_score: newPriorityScore,
          status: existingWord.status === 'mastered' ? 'recalling' : existingWord.status,
        })
        .eq('id', existingWord.id)
        .select()
        .single()

      if (updateError) throw updateError

      return NextResponse.json({
        message: 'Word priority increased',
        userWord: updated,
        isNew: false,
      })
    }

    const { data: newUserWord, error: insertError } = await supabase
      .from('user_words')
      .insert({
        user_id: user.id,
        word_id: wordId,
        status: 'revising',
        priority_score: 80,
        ease_factor: 2.5,
        interval: 0,
        repetitions: 0,
        correct_count: 0,
        incorrect_count: 0,
        next_review_date: new Date().toISOString(),
      })
      .select()
      .single()

    if (insertError) throw insertError

    return NextResponse.json({
      message: 'Word added to your dictionary',
      userWord: newUserWord,
      isNew: true,
    })
  } catch (error) {
    console.error('Add word error:', error)
    return NextResponse.json({ error: 'Failed to add word' }, { status: 500 })
  }
}
