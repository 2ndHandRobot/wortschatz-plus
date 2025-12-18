'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { WordList, WordListItem } from '@/types/vocabulary'
import { getTargetWord } from '@/lib/vocabulary-utils'
import Link from 'next/link'

export default function ListDetailPage() {
  const params = useParams()
  const router = useRouter()
  const listId = params.id as string

  const [list, setList] = useState<WordList | null>(null)
  const [items, setItems] = useState<WordListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [showShareModal, setShowShareModal] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    fetchList()
  }, [listId])

  const fetchList = async () => {
    try {
      const response = await fetch(`/api/lists/${listId}`)
      if (!response.ok) {
        if (response.status === 404) {
          setError('List not found')
        } else {
          throw new Error('Failed to fetch list')
        }
        return
      }

      const data = await response.json()
      setList(data.list)
      setItems(data.list.items || [])

      // If list already has share code, set the URL
      if (data.list.shareCode) {
        setShareUrl(`${window.location.origin}/shared/${data.list.shareCode}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load list')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateShareLink = async () => {
    setGenerating(true)
    setError(null)

    try {
      const response = await fetch(`/api/lists/${listId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      if (!response.ok) throw new Error('Failed to generate share link')

      const data = await response.json()
      setShareUrl(data.shareUrl)
      setList(data.list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate share link')
    } finally {
      setGenerating(false)
    }
  }

  const handleCopyShareLink = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl)
      alert('Share link copied to clipboard!')
    }
  }

  const handleRemoveShareLink = async () => {
    try {
      const response = await fetch(`/api/lists/${listId}/share`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to remove share link')

      const data = await response.json()
      setShareUrl(null)
      setList(data.list)
      setShowShareModal(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove share link')
    }
  }

  const handleRemoveWord = async (vocabularyId: string) => {
    try {
      const response = await fetch(`/api/lists/${listId}/items?vocabularyId=${vocabularyId}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to remove word')

      setItems(items.filter((item) => item.vocabularyId !== vocabularyId))
      if (list) {
        setList({ ...list, itemCount: (list.itemCount || 0) - 1 })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove word')
    }
  }

  const handleAddToDictionary = async (vocabularyId: string) => {
    try {
      const response = await fetch('/api/words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vocabularyId }),
      })

      if (!response.ok) throw new Error('Failed to add word to dictionary')

      // Refresh the list to get updated user_words data
      await fetchList()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add word to dictionary')
    }
  }

  const handleRemoveFromDictionary = async (vocabularyId: string) => {
    try {
      // Find the user_word entry for this vocabulary ID
      const item = items.find(i => i.vocabularyId === vocabularyId)
      const userWord = (item as any)?.userWord

      if (!userWord?.id) {
        setError('Word not found in dictionary')
        return
      }

      const response = await fetch(`/api/words/${userWord.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to remove word from dictionary')

      // Refresh the list to get updated user_words data
      await fetchList()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove word from dictionary')
    }
  }

  const handleDeleteList = async () => {
    setDeleting(true)
    setError(null)

    try {
      const response = await fetch(`/api/lists/${listId}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete list')

      router.push('/lists')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete list')
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-center text-gray-600">Loading list...</p>
      </div>
    )
  }

  if (error && !list) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">{error}</p>
        </div>
        <Link href="/lists" className="text-blue-600 hover:text-blue-800 mt-4 inline-block">
          ← Back to lists
        </Link>
      </div>
    )
  }

  if (!list) return null

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Link href="/lists" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
          ← Back to lists
        </Link>

        <div className="flex justify-between items-start mt-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{list.name}</h1>
            {list.description && (
              <p className="text-gray-600 mb-2">{list.description}</p>
            )}
            <p className="text-sm text-gray-500 capitalize">
              {list.language} • {items.length} {items.length === 1 ? 'word' : 'words'}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowShareModal(true)}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors font-medium flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Share
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors font-medium"
            >
              Delete List
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <p className="text-gray-600 mb-4">
            This list is empty. Add words from your dictionary!
          </p>
          <Link
            href="/dictionary"
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
          >
            Go to Dictionary
          </Link>
        </div>
      ) : (
        <div>
          <div className="mb-4">
            <button
              onClick={() => {
                const wordIds = items.map(item => item.vocabularyId)
                sessionStorage.setItem('studyWordIds', JSON.stringify(wordIds))
                router.push('/learn?mode=study-selection')
              }}
              className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition-colors font-medium"
            >
              Study ({items.length})
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Word
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Difficulty
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Translation
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {items.map((item) => {
                  const vocab = item.vocabulary
                  if (!vocab) return null

                  const priorityScore = (item as any).priorityScore
                  const userWord = (item as any).userWord

                  // Determine priority badge color
                  let priorityColor = 'bg-gray-100 text-gray-800'
                  if (priorityScore >= 80) {
                    priorityColor = 'bg-red-100 text-red-800'
                  } else if (priorityScore >= 60) {
                    priorityColor = 'bg-orange-100 text-orange-800'
                  } else if (priorityScore >= 40) {
                    priorityColor = 'bg-yellow-100 text-yellow-800'
                  } else if (priorityScore >= 20) {
                    priorityColor = 'bg-green-100 text-green-800'
                  }

                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        {userWord ? (
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${priorityColor}`}>
                              {priorityScore}
                            </span>
                            <span className="text-xs text-gray-500 capitalize">{userWord.status}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-gray-900">
                          {vocab.type === 'noun' && 'article' in vocab && vocab.article
                            ? `${vocab.article} `
                            : ''}
                          {getTargetWord(vocab)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500 capitalize">{vocab.type}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{vocab.difficulty || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{vocab.english.join(', ')}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          {/* Dictionary status icon */}
                          <div className={userWord ? 'text-green-600' : 'text-gray-400'} title={userWord ? 'In dictionary' : 'Not in dictionary'}>
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                            </svg>
                          </div>

                          {/* Add/Remove from dictionary buttons */}
                          {userWord ? (
                            <button
                              onClick={() => handleRemoveFromDictionary(item.vocabularyId)}
                              className="text-orange-600 hover:text-orange-800"
                              aria-label="Remove from dictionary"
                              title="Remove from dictionary"
                            >
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                              </svg>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleAddToDictionary(item.vocabularyId)}
                              className="text-blue-600 hover:text-blue-800"
                              aria-label="Add to dictionary"
                              title="Add to dictionary"
                            >
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                              </svg>
                            </button>
                          )}

                          {/* Remove from list button */}
                          <button
                            onClick={() => handleRemoveWord(item.vocabularyId)}
                            className="text-red-600 hover:text-red-800"
                            aria-label="Remove from list"
                            title="Remove from list"
                          >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path
                                fillRule="evenodd"
                                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowShareModal(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Share List</h2>

            {shareUrl ? (
              <div className="space-y-4">
                <p className="text-gray-600">Anyone with this link can view and import this list:</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={shareUrl}
                    readOnly
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm"
                  />
                  <button
                    onClick={handleCopyShareLink}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Copy
                  </button>
                </div>
                <button
                  onClick={handleRemoveShareLink}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  Remove share link and make list private
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-gray-600">
                  Generate a share link to let others view and import this list.
                </p>
                <button
                  onClick={handleGenerateShareLink}
                  disabled={generating}
                  className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:bg-green-400 transition-colors font-medium"
                >
                  {generating ? 'Generating...' : 'Generate Share Link'}
                </button>
              </div>
            )}

            <button
              onClick={() => setShowShareModal(false)}
              className="w-full mt-4 bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300 transition-colors font-medium"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => !deleting && setShowDeleteConfirm(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-gray-900 mb-2">Delete List?</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete <span className="font-semibold">"{list.name}"</span>?
              This action cannot be undone.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300 disabled:opacity-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteList}
                disabled={deleting}
                className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 disabled:bg-red-400 transition-colors font-medium"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
