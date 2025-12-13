'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { UserWord, VocabularyEntry } from '@/types/vocabulary'
import WordCard from '@/components/learn/WordCard'
import WordEditForm from '@/components/vocabulary/WordEditForm'
import { mapUserWordFromDb, getTargetWord } from '@/lib/vocabulary-utils'

export default function DictionaryPage() {
  const [words, setWords] = useState<UserWord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedWord, setSelectedWord] = useState<VocabularyEntry | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [enriching, setEnriching] = useState(false)
  const [enrichMessage, setEnrichMessage] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isNavOpen, setIsNavOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [targetLanguage, setTargetLanguage] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchUserLanguage()
  }, [])

  useEffect(() => {
    if (targetLanguage) {
      fetchWords()
    }
  }, [targetLanguage])

  const fetchUserLanguage = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('target_language')
          .eq('id', user.id)
          .single()

        // Set the language from profile, or default to 'german' if not set
        setTargetLanguage(profile?.target_language || 'german')
      }
    } catch (err) {
      console.error('Error fetching user language:', err)
      // Fallback to german on error
      setTargetLanguage('german')
    }
  }

  const fetchWords = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error: fetchError } = await supabase
        .from('user_words')
        .select(`
          *,
          vocabulary!inner (*)
        `)
        .eq('user_id', user.id)
        .eq('vocabulary.language', targetLanguage)

      if (fetchError) throw fetchError

      // Map database fields to TypeScript types
      const mappedData = (data as any[]).map(mapUserWordFromDb)

      // Sort words alphabetically by the target language root form
      const sortedData = (mappedData as UserWord[]).sort((a, b) => {
        const wordA = a.vocabulary ? getTargetWord(a.vocabulary).toLowerCase() : ''
        const wordB = b.vocabulary ? getTargetWord(b.vocabulary).toLowerCase() : ''
        return wordA.localeCompare(wordB, 'de')
      })

      setWords(sortedData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load words')
    } finally {
      setLoading(false)
    }
  }

  const enrichVocabulary = async () => {
    try {
      setEnriching(true)
      setEnrichMessage(null)
      setError(null)

      const response = await fetch('/api/vocabulary/enrich', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to enrich vocabulary')
      }

      setEnrichMessage(
        `Successfully enriched ${result.enriched} out of ${result.total} words!`
      )

      // Refresh the words list to show updated data
      await fetchWords()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enrich vocabulary')
    } finally {
      setEnriching(false)
    }
  }

  const handleSaveWord = async (updatedWord: VocabularyEntry) => {
    try {
      const response = await fetch('/api/vocabulary/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedWord),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update word')
      }

      // Update local state
      setWords(prevWords =>
        prevWords.map(w =>
          w.vocabulary?.id === updatedWord.id
            ? { ...w, vocabulary: result.word }
            : w
        )
      )

      // Update selected word if it's the same
      if (selectedWord?.id === updatedWord.id) {
        setSelectedWord(result.word)
      }

      // Close edit form
      setIsEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes')
      throw err
    }
  }

  const handleDeleteWord = async () => {
    if (!selectedWord) return

    // Find the user_word entry for this vocabulary word
    const userWord = words.find(w => w.vocabulary?.id === selectedWord.id)
    if (!userWord) {
      setError('Word not found in your dictionary')
      setShowDeleteConfirm(false)
      return
    }

    setDeleting(true)
    setError(null)

    try {
      console.log('Deleting word with user_word id:', userWord.id)
      const response = await fetch(`/api/words/${userWord.id}`, {
        method: 'DELETE',
      })

      console.log('Delete response status:', response.status)

      if (!response.ok) {
        const result = await response.json()
        console.error('Delete error:', result)
        throw new Error(result.error || 'Failed to remove word')
      }

      const successMessage = `"${getTargetWord(selectedWord)}" removed from your dictionary`

      // Close modals and clear selection first
      setShowDeleteConfirm(false)
      setSelectedWord(null)
      setIsEditing(false)

      // Remove word from local state
      setWords(prevWords => prevWords.filter(w => w.id !== userWord.id))

      // Show success message
      setEnrichMessage(successMessage)
      setTimeout(() => setEnrichMessage(null), 3000)
    } catch (err) {
      console.error('Failed to delete word:', err)
      setError(err instanceof Error ? err.message : 'Failed to remove word')
      setShowDeleteConfirm(false)
    } finally {
      setDeleting(false)
    }
  }

  // Filter words based on search query
  const filterWords = () => {
    if (!searchQuery.trim()) {
      return words
    }

    const query = searchQuery.toLowerCase()
    return words.filter((word) => {
      if (!word.vocabulary) return false

      const vocab = word.vocabulary

      // Search only in target language word
      return getTargetWord(vocab).toLowerCase().includes(query)
    })
  }

  // Group words by first letter
  const groupWordsByLetter = () => {
    const filteredWords = filterWords()
    const grouped: Record<string, UserWord[]> = {}

    filteredWords.forEach((word) => {
      if (word.vocabulary) {
        const targetWord = getTargetWord(word.vocabulary)
        if (targetWord) {
          const firstLetter = targetWord[0].toUpperCase()
          if (!grouped[firstLetter]) {
            grouped[firstLetter] = []
          }
          grouped[firstLetter].push(word)
        }
      }
    })

    // Sort letters alphabetically
    return Object.keys(grouped)
      .sort((a, b) => a.localeCompare(b, 'de'))
      .map(letter => ({
        letter,
        words: grouped[letter]
      }))
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="text-center">
          <p className="text-gray-600">Loading your dictionary...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">My Dictionary</h1>
            <p className="text-gray-600">
              {words.length} {words.length === 1 ? 'word' : 'words'} in your collection
            </p>
          </div>
          {/* <button
            onClick={enrichVocabulary}
            disabled={enriching || words.length === 0}
            className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {enriching ? 'Enriching...' : 'Enrich All Words'}
          </button> */}
        </div>

        {/* Search Bar */}
        <div className="mt-4">
          <div className="relative">
            <input
              type="text"
              placeholder={`Search ${targetLanguage ? targetLanguage.charAt(0).toUpperCase() + targetLanguage.slice(1) : ''} words...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <svg
              className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            )}
          </div>
        </div>

        {enrichMessage && (
          <div className="mt-4 bg-green-50 border border-green-200 rounded-md p-4">
            <p className="text-green-800">{enrichMessage}</p>
          </div>
        )}
      </div>

      {words.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <p className="text-gray-600 mb-4">
            Your dictionary is empty. Start by looking up some words!
          </p>
          <a
            href="/"
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
          >
            Look up words
          </a>
        </div>
      ) : (
        <>
          {groupWordsByLetter().length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <p className="text-gray-600 mb-2">
                No words found matching "{searchQuery}"
              </p>
              <button
                onClick={() => setSearchQuery('')}
                className="text-blue-600 hover:text-blue-700 text-sm"
              >
                Clear search
              </button>
            </div>
          ) : (
            <div className="flex gap-6">
              {/* Alphabetical Navigation */}
              <div className="hidden md:block">
                <div className="sticky top-4">
                  <div className="bg-white rounded-lg shadow-md p-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Jump to</h3>
                    <div className="flex flex-col gap-1">
                      {groupWordsByLetter().map(({ letter }) => (
                        <a
                          key={letter}
                          href={`#letter-${letter}`}
                          className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-1 rounded transition-colors text-center font-medium"
                        >
                          {letter}
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Mobile Navigation Toggle */}
              <button
                onClick={() => setIsNavOpen(!isNavOpen)}
                className="md:hidden fixed bottom-6 right-6 z-20 bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              {/* Mobile Navigation Panel */}
              {isNavOpen && (
                <div
                  className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
                  onClick={() => setIsNavOpen(false)}
                >
                  <div
                    className="absolute left-0 top-0 bottom-0 w-64 bg-white shadow-xl p-6"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">Jump to</h3>
                      <button
                        onClick={() => setIsNavOpen(false)}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {groupWordsByLetter().map(({ letter }) => (
                        <a
                          key={letter}
                          href={`#letter-${letter}`}
                          onClick={() => setIsNavOpen(false)}
                          className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-2 rounded transition-colors text-center font-medium"
                        >
                          {letter}
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Words List */}
              <div className="flex-1 space-y-8">
                {groupWordsByLetter().map(({ letter, words: letterWords }) => (
                  <div key={letter} id={`letter-${letter}`}>
                    <div className="sticky top-0 bg-gray-50 border-b-2 border-gray-300 py-3 px-4 mb-4 z-10">
                      <h2 className="text-2xl font-bold text-gray-900">{letter}</h2>
                    </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {letterWords.map((userWord) => {
                  const vocab = userWord.vocabulary
                  if (!vocab) return null

                  return (
                    <div
                      key={userWord.id}
                      className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer"
                      onClick={() => setSelectedWord(vocab)}
                    >
                      <div className="mb-4">
                        <h3 className="text-xl font-bold text-gray-900">
                          {vocab.type === 'noun' && 'article' in vocab && vocab.article ? `${vocab.article} ` : ''}{getTargetWord(vocab)}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {vocab.type} • {vocab.difficulty || 'N/A'}
                        </p>
                        <div className="mt-2">
                          <span
                            className={`inline-block px-2 py-1 text-xs font-semibold rounded ${
                              userWord.status === 'mastered'
                                ? 'bg-green-100 text-green-800'
                                : userWord.status === 'practicing'
                                ? 'bg-blue-100 text-blue-800'
                                : userWord.status === 'recalling'
                                ? 'bg-yellow-100 text-yellow-800'
                                : userWord.status === 'revising'
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {userWord.status}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2 text-sm">
                        <p className="text-gray-900">
                          <span className="font-semibold">Translation:</span>{' '}
                          {vocab.english.join(', ')}
                        </p>

                        {vocab.type === 'noun' && 'article' in vocab && vocab.article && (
                          <p className="text-gray-900">
                            <span className="font-semibold">Article:</span> {vocab.article}{' '}
                            {vocab.gender && `(${vocab.gender})`}
                          </p>
                        )}

                        {vocab.type === 'verb' &&
                          'conjugation' in vocab &&
                          vocab.conjugation?.perfect && (
                            <p className="text-gray-900">
                              <span className="font-semibold">Perfect:</span>{' '}
                              {vocab.conjugation.perfect}
                            </p>
                          )}

                        <p className="text-gray-600">
                          <span className="font-semibold">Practice score:</span>{' '}
                          {userWord.correctCount} / {userWord.correctCount + userWord.incorrectCount}
                        </p>
                      </div>

                      <div className="mt-4 pt-4 border-t">
                        <button
                          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors font-medium text-sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            const mode = userWord.status === 'revising' ? 'revise' :
                                       userWord.status === 'recalling' ? 'recall' :
                                       userWord.status === 'practicing' ? 'practice' :
                                       'practice'
                            window.location.href = `/learn?mode=${mode}&wordId=${userWord.id}`
                          }}
                        >
                          Study
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal for detailed word view */}
      {selectedWord && !isEditing && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedWord(null)}
        >
          <div
            className="max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              <WordCard
                word={selectedWord}
                headerButton={
                  <button
                    onClick={() => setSelectedWord(null)}
                    className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
                  >
                    ×
                  </button>
                }
              />
              <div className="bg-white px-8 pb-6 rounded-b-lg -mt-2 space-y-3">
                <button
                  onClick={() => {
                    // Find the user word that matches the selected vocabulary word
                    const userWord = words.find(w => w.vocabulary?.id === selectedWord.id)
                    if (userWord) {
                      const mode = userWord.status === 'revising' ? 'revise' :
                                 userWord.status === 'recalling' ? 'recall' :
                                 userWord.status === 'practicing' ? 'practice' :
                                 'practice'
                      window.location.href = `/learn?mode=${mode}&wordId=${userWord.id}`
                    } else {
                      window.location.href = '/learn'
                    }
                  }}
                  className="w-full bg-blue-600 text-white py-3 px-6 rounded-md hover:bg-blue-700 transition-colors font-medium"
                >
                  Study
                </button>
                <button
                  onClick={() => setIsEditing(true)}
                  className="w-full bg-gray-600 text-white py-3 px-6 rounded-md hover:bg-gray-700 transition-colors font-medium"
                >
                  Edit
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={deleting}
                  className="w-full bg-red-600 text-white py-3 px-6 rounded-md hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  Remove from Dictionary
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Form Modal */}
      {selectedWord && isEditing && (
        <WordEditForm
          word={selectedWord}
          onSave={handleSaveWord}
          onCancel={() => setIsEditing(false)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedWord && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => !deleting && setShowDeleteConfirm(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Remove from Dictionary?</h3>
              <p className="text-gray-600">
                Are you sure you want to remove <span className="font-semibold">"{getTargetWord(selectedWord)}"</span> from your dictionary?
              </p>
              <p className="text-gray-600 mt-2">
                This will delete your learning progress for this word.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteWord}
                disabled={deleting}
                className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {deleting ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
