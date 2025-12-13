import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { selectWordsForSession } from '@/lib/spaced-repetition'
import { getUserLLMConfig, LLMService } from '@/lib/llm/service'
import { mapUserWordFromDb, getTargetWord } from '@/lib/vocabulary-utils'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sessionType, mode, wordId } = await request.json()

    if (!sessionType || !mode) {
      return NextResponse.json(
        { error: 'Session type and mode are required' },
        { status: 400 }
      )
    }

    // Get user's target language
    const { data: profile } = await supabase
      .from('profiles')
      .select('target_language')
      .eq('id', user.id)
      .single()

    const targetLanguage = profile?.target_language || 'german'

    let selectedWords: any[] = []

    // If a specific word ID is provided, use only that word
    if (wordId) {
      const { data: specificWord, error: wordError } = await supabase
        .from('user_words')
        .select(`
          *,
          vocabulary (*)
        `)
        .eq('id', wordId)
        .eq('user_id', user.id)
        .single()

      if (wordError) throw wordError

      if (specificWord) {
        selectedWords = [mapUserWordFromDb(specificWord)]
      }
    } else {
      // Fetch user words with vocabulary data filtered by target language
      const { data: userWords, error: fetchError } = await supabase
        .from('user_words')
        .select(`
          *,
          vocabulary!inner (*)
        `)
        .eq('user_id', user.id)
        .eq('vocabulary.language', targetLanguage)

      if (fetchError) throw fetchError

      // Map database fields to TypeScript types
      const mappedWords = (userWords || []).map(mapUserWordFromDb)

      // Select words based on mode and session type using spaced repetition algorithm
      selectedWords = selectWordsForSession(
        mappedWords,
        mode,
        sessionType
      )
    }

    if (selectedWords.length === 0) {
      return NextResponse.json({
        error: `No words available for ${mode} mode`,
        words: [],
        exercises: [],
      })
    }

    // Create learning session
    const { data: session, error: sessionError } = await supabase
      .from('learning_sessions')
      .insert({
        user_id: user.id,
        session_type: sessionType,
        started_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (sessionError) throw sessionError

    // Prepare response based on mode
    let responseData: any = {
      sessionId: session.id,
    }

    if (mode === 'revise') {
      // For revise mode, return words with full vocabulary data
      responseData.words = selectedWords
    } else if (mode === 'recall') {
      // For recall mode, generate exercises
      responseData.exercises = await generateRecallExercises(selectedWords)
    } else if (mode === 'practice') {
      // For practice mode, generate translation exercises
      responseData.exercises = await generatePracticeExercises(selectedWords, user.id, supabase, targetLanguage)
    }

    return NextResponse.json(responseData)
  } catch (error) {
    console.error('Start session error:', error)
    return NextResponse.json(
      { error: 'Failed to start session' },
      { status: 500 }
    )
  }
}

// Helper function to generate recall exercises
async function generateRecallExercises(words: any[]) {
  const exercises = []

  for (const userWord of words) {
    const word = userWord.vocabulary

    if (!word) continue

    // Generate different types of recall questions based on word type
    let question = ''
    let answer = ''
    let context = ''

    const targetWord = getTargetWord(word)

    if (word.type === 'noun') {
      // Ask for article and plural
      const questionType = Math.random() > 0.5 ? 'article' : 'plural'
      if (questionType === 'article' && word.article) {
        question = `What is the article for "${targetWord}"?`
        answer = word.article
        context = `Meaning: ${word.english.join(', ')}`
      } else if (word.plural) {
        question = `What is the plural form of "${targetWord}"?`
        answer = word.plural
        context = `Article: ${word.article || 'N/A'}`
      }
    } else if (word.type === 'verb') {
      // Ask for conjugation or auxiliary
      const questionType = Math.random() > 0.5 ? 'perfect' : 'auxiliary'
      if (questionType === 'perfect' && word.conjugation?.perfect) {
        question = `What is the past participle of "${targetWord}"?`
        answer = word.conjugation.perfect
        context = `Meaning: ${word.english.join(', ')}`
      } else if (word.auxiliary) {
        question = `What is the auxiliary verb for "${targetWord}"?`
        answer = word.auxiliary
        context = `Meaning: ${word.english.join(', ')}`
      }
    } else if (word.type === 'adjective') {
      // Ask for comparative or superlative
      if (word.comparative) {
        question = `What is the comparative form of "${targetWord}"?`
        answer = word.comparative
        context = `Meaning: ${word.english.join(', ')}`
      }
    } else {
      // For other types, ask for translation
      question = `Translate "${targetWord}" to English`
      answer = word.english[0]
      context = `Type: ${word.type}`
    }

    if (question && answer) {
      exercises.push({
        userWordId: userWord.id,
        word: userWord,
        exerciseType: 'fill_blank',
        question,
        answer,
        context,
      })
    }
  }

  return exercises
}

// Helper function to generate practice exercises
async function generatePracticeExercises(words: any[], userId: string, supabase: any, targetLanguage: string) {
  const exercises = []

  // Get LLM config once for all exercises
  const llmConfig = await getUserLLMConfig(supabase, userId)

  // Capitalize the language name for prompts
  const languageCapitalized = targetLanguage.charAt(0).toUpperCase() + targetLanguage.slice(1)

  for (const userWord of words.slice(0, 5)) { // Limit to 5 for practice mode with AI
    const word = userWord.vocabulary

    if (!word) continue

    // Generate practice sentence using LLM directly
    try {
      if (!llmConfig) {
        throw new Error('AI provider not configured')
      }

      const llmService = new LLMService(llmConfig)
      const englishTranslations = Array.isArray(word.english) ? word.english.join(', ') : word.english
      const targetWord = getTargetWord(word)

      const prompt = `Create a simple natural English sentence that, when translated to ${languageCapitalized}, would use the word "${targetWord}".

Context:
- ${languageCapitalized} word: ${targetWord}
- English meaning: ${englishTranslations}
- Word type: ${word.type}
- Difficulty level: ${word.difficulty}

IMPORTANT: The sentence should be at roughly one CEFR language level than the word being practiced (${word.difficulty}). Use appropriate vocabulary complexity, sentence structure, and grammar that matches this level. The sentence should be appropriate for a ${word.difficulty} ${languageCapitalized} learner and naturally use the word in context.

Return a JSON object with this structure:
{
  "sentenceEnglish": "The English sentence",
  "sentenceGerman": "The ${languageCapitalized} translation"
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

      exercises.push({
        userWordId: userWord.id,
        word: userWord,
        sentenceGerman: exerciseData.sentenceGerman,
        sentenceEnglish: exerciseData.sentenceEnglish,
        targetWord: targetWord,
        difficulty: word.difficulty || 'A1',
      })
    } catch (error) {
      console.error('Failed to generate practice exercise:', error)
      // Fallback to example sentences if available
      if (word.examples && word.examples.length > 0) {
        // Random selection instead of always using [0]
        const randomIndex = Math.floor(Math.random() * word.examples.length)
        const example = word.examples[randomIndex]
        const targetWord = getTargetWord(word)
        exercises.push({
          userWordId: userWord.id,
          word: userWord,
          sentenceGerman: example.german,
          sentenceEnglish: example.english,
          targetWord: targetWord,
          difficulty: word.difficulty || 'A1',
        })
      }
    }
  }

  return exercises
}
