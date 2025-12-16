'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { WordList } from '@/types/vocabulary'
import Link from 'next/link'

export default function ListsPage() {
  const router = useRouter()
  const [lists, setLists] = useState<WordList[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [newListDescription, setNewListDescription] = useState('')
  const [language, setLanguage] = useState('german')
  const [shareCodeInput, setShareCodeInput] = useState('')

  useEffect(() => {
    fetchLists()
    fetchUserLanguage()
  }, [])

  const fetchUserLanguage = async () => {
    try {
      const response = await fetch('/api/profile')
      if (response.ok) {
        const data = await response.json()
        setLanguage(data.profile.target_language || 'german')
      }
    } catch (err) {
      console.error('Failed to fetch user language:', err)
    }
  }

  const fetchLists = async () => {
    try {
      const response = await fetch('/api/lists')
      if (!response.ok) throw new Error('Failed to fetch lists')

      const data = await response.json()
      setLists(data.lists || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load lists')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newListName.trim()) return

    setCreating(true)
    setError(null)

    try {
      const response = await fetch('/api/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newListName.trim(),
          description: newListDescription.trim() || undefined,
          language,
        }),
      })

      if (!response.ok) throw new Error('Failed to create list')

      const data = await response.json()
      setLists([data.list, ...lists])
      setShowCreateModal(false)
      setNewListName('')
      setNewListDescription('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create list')
    } finally {
      setCreating(false)
    }
  }

  const handleImportList = (e: React.FormEvent) => {
    e.preventDefault()
    if (!shareCodeInput.trim()) return

    // Extract share code from URL or use as-is
    let shareCode = shareCodeInput.trim()

    // If it looks like a URL, extract the code
    if (shareCode.includes('/shared/')) {
      const match = shareCode.match(/\/shared\/([a-zA-Z0-9]+)/)
      if (match) {
        shareCode = match[1]
      }
    }

    // Redirect to the shared list page
    router.push(`/shared/${shareCode}`)
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-center text-gray-600">Loading your lists...</p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Word Lists</h1>
          <p className="text-gray-600">
            {lists.length} {lists.length === 1 ? 'list' : 'lists'}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowImportModal(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors font-medium flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Import List
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors font-medium"
          >
            Create List
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {lists.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <p className="text-gray-600 mb-4">
            You haven't created any word lists yet.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
          >
            Create your first list
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {lists.map((list) => (
            <Link
              key={list.id}
              href={`/lists/${list.id}`}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer group"
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                  {list.name}
                </h3>
                <span className="text-sm text-gray-500 capitalize">
                  {list.language}
                </span>
              </div>

              {list.description && (
                <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                  {list.description}
                </p>
              )}

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">
                  {list.itemCount || 0} {list.itemCount === 1 ? 'word' : 'words'}
                </span>
                {list.isPublic && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                    </svg>
                    Shared
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create List Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => !creating && setShowCreateModal(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Create New List</h2>

            <form onSubmit={handleCreateList} className="space-y-4">
              <div>
                <label htmlFor="listName" className="block text-sm font-medium text-gray-700 mb-1">
                  List Name *
                </label>
                <input
                  id="listName"
                  type="text"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="e.g., Restaurant Vocabulary"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label htmlFor="listDescription" className="block text-sm font-medium text-gray-700 mb-1">
                  Description (optional)
                </label>
                <textarea
                  id="listDescription"
                  value={newListDescription}
                  onChange={(e) => setNewListDescription(e.target.value)}
                  placeholder="What is this list for?"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div>
                <label htmlFor="language" className="block text-sm font-medium text-gray-700 mb-1">
                  Language
                </label>
                <select
                  id="language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="german">German</option>
                  <option value="french">French</option>
                  <option value="spanish">Spanish</option>
                  <option value="italian">Italian</option>
                  <option value="portuguese">Portuguese</option>
                  <option value="dutch">Dutch</option>
                  <option value="swedish">Swedish</option>
                  <option value="danish">Danish</option>
                  <option value="norwegian">Norwegian</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={creating}
                  className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300 disabled:opacity-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newListName.trim()}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import List Modal */}
      {showImportModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowImportModal(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Import Shared List</h2>

            <form onSubmit={handleImportList} className="space-y-4">
              <div>
                <label htmlFor="shareCode" className="block text-sm font-medium text-gray-700 mb-1">
                  Share Code or URL
                </label>
                <input
                  id="shareCode"
                  type="text"
                  value={shareCodeInput}
                  onChange={(e) => setShareCodeInput(e.target.value)}
                  placeholder="e.g., vhMGHzCGEg or full URL"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                  autoFocus
                />
                <p className="mt-2 text-sm text-gray-500">
                  Paste either the share code (e.g., <code className="bg-gray-100 px-1 rounded">vhMGHzCGEg</code>) or the full share URL.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!shareCodeInput.trim()}
                  className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  Continue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
