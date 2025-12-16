'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { WordList, WordListItem } from '@/types/vocabulary'
import { getTargetWord } from '@/lib/vocabulary-utils'
import Link from 'next/link'

export default function SharedListPage() {
  const params = useParams()
  const router = useRouter()
  const shareCode = params.code as string

  const [list, setList] = useState<(WordList & { items?: WordListItem[]; creator?: { name: string } }) | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [imported, setImported] = useState(false)

  useEffect(() => {
    fetchSharedList()
  }, [shareCode])

  const fetchSharedList = async () => {
    try {
      const response = await fetch(`/api/lists/shared/${shareCode}`)

      if (!response.ok) {
        if (response.status === 404) {
          setError('This list does not exist or is no longer shared.')
        } else {
          throw new Error('Failed to load list')
        }
        return
      }

      const data = await response.json()
      setList(data.list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load list')
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async () => {
    setImporting(true)
    setError(null)

    try {
      const response = await fetch(`/api/lists/shared/${shareCode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      if (!response.ok) {
        if (response.status === 401) {
          // Not logged in - redirect to login
          router.push(`/login?redirect=/shared/${shareCode}`)
          return
        }
        throw new Error('Failed to import list')
      }

      const data = await response.json()
      setImported(true)

      // Redirect to the new list after 2 seconds
      setTimeout(() => {
        router.push(`/lists/${data.list.id}`)
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import list')
    } finally {
      setImporting(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-center text-gray-600">Loading shared list...</p>
      </div>
    )
  }

  if (error && !list) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
          <p className="text-red-800">{error}</p>
        </div>
        <Link href="/" className="text-blue-600 hover:text-blue-800">
          ← Go to home
        </Link>
      </div>
    )
  }

  if (!list) return null

  const items = list.items || []

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
            </svg>
            <span className="font-semibold text-blue-900">Shared List</span>
          </div>
          <p className="text-sm text-blue-800">
            Shared by {list.creator?.name || 'another user'}
          </p>
        </div>

        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{list.name}</h1>
            {list.description && (
              <p className="text-gray-600 mb-2">{list.description}</p>
            )}
            <p className="text-sm text-gray-500 capitalize">
              {list.language} • {items.length} {items.length === 1 ? 'word' : 'words'}
            </p>
          </div>

          <button
            onClick={handleImport}
            disabled={importing || imported}
            className="bg-green-600 text-white px-6 py-3 rounded-md hover:bg-green-700 disabled:bg-green-400 transition-colors font-medium flex items-center gap-2"
          >
            {imported ? (
              <>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Imported!
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {importing ? 'Importing...' : 'Import to My Lists'}
              </>
            )}
          </button>
        </div>

        {imported && (
          <div className="mt-4 bg-green-50 border border-green-200 rounded-md p-4">
            <p className="text-green-800">
              List imported successfully! Redirecting to your copy...
            </p>
          </div>
        )}

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <p className="text-gray-600">This list is empty.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => {
            const vocab = item.vocabulary
            if (!vocab) return null

            return (
              <div
                key={item.id}
                className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
              >
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  {vocab.type === 'noun' && 'article' in vocab && vocab.article
                    ? `${vocab.article} `
                    : ''}
                  {getTargetWord(vocab)}
                </h3>

                <p className="text-sm text-gray-500 mb-2">
                  {vocab.type} • {vocab.difficulty || 'N/A'}
                </p>

                <p className="text-gray-900 text-sm">
                  <span className="font-semibold">Translation:</span> {vocab.english.join(', ')}
                </p>

                {vocab.examples && vocab.examples.length > 0 && vocab.examples[0].english && (
                  <p className="text-gray-600 text-sm mt-2 italic">
                    "{vocab.examples[0].english}"
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-8 text-center">
        <Link href="/" className="text-blue-600 hover:text-blue-800">
          Create your own vocabulary lists →
        </Link>
      </div>
    </div>
  )
}
