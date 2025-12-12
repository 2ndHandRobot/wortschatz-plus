import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { selectWordsForSession } from '@/lib/spaced-repetition'
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

    const { sessionType, mode, wordId } = await request.json()

    if (!sessionType || !mode) {
      return NextResponse.json(
        { error: 'Session type and mode are required' },
        { status: 400 }
      )
    }

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
        selectedWords = [specificWord]
      }
    } else {
      // Fetch user words with vocabulary data
      const { data: userWords, error: fetchError } = await supabase
        .from('user_words')
        .select(`
          *,
          vocabulary (*)
        `)
        .eq('user_id', user.id)

      if (fetchError) throw fetchError

      // Select words based on mode and session type using spaced repetition algorithm
      selectedWords = selectWordsForSession(
        userWords || [],
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
      responseData.exercises = await generatePracticeExercises(selectedWords, user.id, supabase)
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

    if (word.type === 'noun') {
      // Ask for article and plural
      const questionType = Math.random() > 0.5 ? 'article' : 'plural'
      if (questionType === 'article' && word.article) {
        question = `What is the article for "${word.german}"?`
        answer = word.article
        context = `Meaning: ${word.english.join(', ')}`
      } else if (word.plural) {
        question = `What is the plural form of "${word.german}"?`
        answer = word.plural
        context = `Article: ${word.article || 'N/A'}`
      }
    } else if (word.type === 'verb') {
      // Ask for conjugation or auxiliary
      const questionType = Math.random() > 0.5 ? 'perfect' : 'auxiliary'
      if (questionType === 'perfect' && word.conjugation?.perfect) {
        question = `What is the past participle of "${word.german}"?`
        answer = word.conjugation.perfect
        context = `Meaning: ${word.english.join(', ')}`
      } else if (word.auxiliary) {
        question = `What is the auxiliary verb for "${word.german}"?`
        answer = word.auxiliary
        context = `Meaning: ${word.english.join(', ')}`
      }
    } else if (word.type === 'adjective') {
      // Ask for comparative or superlative
      if (word.comparative) {
        question = `What is the comparative form of "${word.german}"?`
        answer = word.comparative
        context = `Meaning: ${word.english.join(', ')}`
      }
    } else {
      // For other types, ask for translation
      question = `Translate "${word.german}" to English`
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
async function generatePracticeExercises(words: any[], userId: string, supabase: any) {
  const exercises = []

  // Get LLM config once for all exercises
  const llmConfig = await getUserLLMConfig(supabase, userId)

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

      const prompt = `Create a natural English sentence that, when translated to German, would use the word "${word.german}".

Context:
- German word: ${word.german}
- English meaning: ${englishTranslations}
- Word type: ${word.type}
- Difficulty level: ${word.difficulty}

IMPORTANT: The sentence should be at roughly the same CEFR language level (${word.difficulty}) as the word being practiced. Use appropriate vocabulary complexity, sentence structure, and grammar that matches this level. The sentence should be appropriate for a ${word.difficulty} German learner and naturally use the word in context.

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

      exercises.push({
        userWordId: userWord.id,
        word: userWord,
        sentenceGerman: exerciseData.sentenceGerman,
        sentenceEnglish: exerciseData.sentenceEnglish,
        targetWord: word.german,
        difficulty: word.difficulty || 'A1',
      })
    } catch (error) {
      console.error('Failed to generate practice exercise:', error)
      // Fallback to example sentences if available
      if (word.examples && word.examples.length > 0) {
        // Random selection instead of always using [0]
        const randomIndex = Math.floor(Math.random() * word.examples.length)
        const example = word.examples[randomIndex]
        exercises.push({
          userWordId: userWord.id,
          word: userWord,
          sentenceGerman: example.german,
          sentenceEnglish: example.english,
          targetWord: word.german,
          difficulty: word.difficulty || 'A1',
        })
      }
    }
  }

  return exercises
}
