'use client'

import { useState } from 'react'
import Link from 'next/link'
import { VocabularyEntry } from '@/types/vocabulary'
import { createClient } from '@/lib/supabase/client'

export default function HomePage() {
  const [searchWord, setSearchWord] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    rootForm: string
    entry: VocabularyEntry
    source: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [addSuccess, setAddSuccess] = useState(false)
  const [existingWord, setExistingWord] = useState<{
    addedAt: string
    status: string
  } | null>(null)
  const supabase = createClient()

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setResult(null)
    setAddSuccess(false)
    setExistingWord(null)
    setLoading(true)

    try {
      const response = await fetch('/api/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: searchWord }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to look up word')
      }

      const data = await response.json()
      setResult(data)

      // Check if word is already in user's dictionary
      const { data: { user } } = await supabase.auth.getUser()
      if (user && data.entry.id) {
        const { data: userWord } = await supabase
          .from('user_words')
          .select('added_at, status')
          .eq('user_id', user.id)
          .eq('word_id', data.entry.id)
          .single()

        if (userWord) {
          setExistingWord({
            addedAt: userWord.added_at,
            status: userWord.status
          })
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleAddToDictionary = async () => {
    if (!result) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/words/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wordData: result.entry,
          source: result.source,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to add word')
      }

      const data = await response.json()
      setAddSuccess(true)
      setTimeout(() => setAddSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome to WortSchatz+
        </h1>
        <p className="text-gray-600">
          Look up German words and build your vocabulary
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <form onSubmit={handleLookup} className="space-y-4">
          <div>
            <label
              htmlFor="word"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Enter a German word or phrase
            </label>
            <input
              type="text"
              id="word"
              value={searchWord}
              onChange={(e) => setSearchWord(e.target.value)}
              placeholder="e.g., gehen, Tisch, gut..."
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Looking up...' : 'Look up word'}
          </button>
        </form>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {addSuccess && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-800">
              Word added to your dictionary!
            </p>
          </div>
        )}

        {result && (
          <div className="mt-6 border-t pt-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {result.entry.german}
                </h2>
                <p className="text-sm text-gray-500">
                  {result.entry.type} • {result.entry.difficulty || 'N/A'}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <button
                  onClick={handleAddToDictionary}
                  disabled={loading || existingWord !== null}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    existingWord
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-green-600 text-white hover:bg-green-700 disabled:opacity-50'
                  }`}
                >
                  {existingWord ? 'Already in Dictionary' : 'Add to Dictionary'}
                </button>
                {existingWord && (
                  <p className="text-xs text-gray-500">
                    Added on {new Date(existingWord.addedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-gray-700">Translations:</h3>
                <p className="text-gray-900">
                  {result.entry.english.join(', ')}
                </p>
              </div>

              {result.entry.type === 'noun' && 'article' in result.entry && (
                <div>
                  <h3 className="font-semibold text-gray-700">Article & Gender:</h3>
                  <p className="text-gray-900">
                    {result.entry.article} ({result.entry.gender})
                  </p>
                  {result.entry.plural && (
                    <p className="text-gray-600">Plural: {result.entry.plural}</p>
                  )}
                </div>
              )}

              {result.entry.type === 'verb' && 'conjugation' in result.entry && result.entry.conjugation && (
                <div>
                  <h3 className="font-semibold text-gray-700">Conjugation:</h3>
                  {result.entry.conjugation.perfect && (
                    <p className="text-gray-600">
                      Past participle: {result.entry.conjugation.perfect}
                    </p>
                  )}
                  {result.entry.auxiliary && (
                    <p className="text-gray-600">
                      Auxiliary: {result.entry.auxiliary}
                    </p>
                  )}
                </div>
              )}

              {result.entry.notes && (
                <div>
                  <h3 className="font-semibold text-gray-700">Notes:</h3>
                  <p className="text-gray-600">{result.entry.notes}</p>
                </div>
              )}

              {result.entry.examples && result.entry.examples.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-700">Examples:</h3>
                  {result.entry.examples.map((example, idx) => (
                    <div key={idx} className="mt-2">
                      <p className="text-gray-900">{example.german}</p>
                      <p className="text-gray-600 italic">{example.english}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/learn"
          className="block bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
        >
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Start Learning
          </h3>
          <p className="text-gray-600">
            Practice with Revise, Recall, and Practice modes
          </p>
        </Link>
        <Link
          href="/dictionary"
          className="block bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
        >
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            My Dictionary
          </h3>
          <p className="text-gray-600">
            View all words in your personal dictionary
          </p>
        </Link>
      </div>
    </div>
  )
}
