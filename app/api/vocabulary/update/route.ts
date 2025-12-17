import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { VocabularyEntry } from '@/types/vocabulary'
import { mapVocabularyFromDb } from '@/lib/vocabulary-utils'

export async function PUT(request: Request) {
  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, ...updateData } = body as VocabularyEntry

    if (!id) {
      return NextResponse.json({ error: 'Word ID is required' }, { status: 400 })
    }

    // Verify the user owns this word by checking user_words
    const { data: userWord, error: userWordError } = await supabase
      .from('user_words')
      .select('word_id')
      .eq('user_id', user.id)
      .eq('word_id', id)
      .single()

    if (userWordError || !userWord) {
      return NextResponse.json(
        { error: 'Word not found or you do not have permission to edit it' },
        { status: 404 }
      )
    }

    // Map camelCase fields to snake_case for database
    const dbUpdateData: any = {}

    // Map common fields
    const fieldMapping: Record<string, string> = {
      targetWord: 'target_word',
      audioUrl: 'audio_url',
      predicativeOnly: 'predicative_only',
      pronounType: 'pronoun_type',
      governsCase: 'governs_case',
      twoWay: 'two_way',
      conjunctionType: 'conjunction_type',
      affectsWordOrder: 'affects_word_order',
      correlativePair: 'correlative_pair',
      expressionCategory: 'expression_category',
      relatedWords: 'related_words',
      prepositionCase: 'preposition_case',
      articleType: 'article_type',
    }

    // Map all fields from camelCase to snake_case
    for (const [key, value] of Object.entries(updateData)) {
      const dbKey = fieldMapping[key] || key
      dbUpdateData[dbKey] = value
    }

    // Map example sentences if they exist
    if (dbUpdateData.examples && Array.isArray(dbUpdateData.examples)) {
      dbUpdateData.examples = dbUpdateData.examples.map((example: any) => ({
        // Keep sentence as the primary field, but maintain backward compatibility
        sentence: example.sentence || example.targetWord || example.german || '',
        english: example.english,
      }))
    }

    // Remove fields that shouldn't be updated
    delete dbUpdateData.id
    delete dbUpdateData.created_at
    delete dbUpdateData.createdAt
    delete dbUpdateData.updated_at
    delete dbUpdateData.updatedAt
    delete dbUpdateData.last_reviewed
    delete dbUpdateData.lastReviewed

    // Filter out null values to only update fields with actual data
    // Keep empty strings and false values, but remove null/undefined
    Object.keys(dbUpdateData).forEach(key => {
      if (dbUpdateData[key] === null || dbUpdateData[key] === undefined) {
        delete dbUpdateData[key]
      }
    })

    console.log('Updating vocabulary with data:', JSON.stringify(dbUpdateData, null, 2))

    // Update the vocabulary entry
    const { data: updatedWord, error: updateError } = await supabase
      .from('vocabulary')
      .update(dbUpdateData)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating vocabulary:', updateError)
      return NextResponse.json(
        { error: 'Failed to update word', details: updateError.message },
        { status: 500 }
      )
    }

    // Map the response back from snake_case to camelCase for the frontend
    const mappedWord = mapVocabularyFromDb(updatedWord)

    return NextResponse.json({
      success: true,
      word: mappedWord,
    })
  } catch (error) {
    console.error('Error in vocabulary update API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
