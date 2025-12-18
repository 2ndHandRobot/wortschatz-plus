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
  const [showSelectSourceModal, setShowSelectSourceModal] = useState(false)
  const [importSource, setImportSource] = useState<'wortschatz' | 'csv' | 'googlesheet' | null>(null)
  const [creating, setCreating] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [newListDescription, setNewListDescription] = useState('')
  const [language, setLanguage] = useState('german')
  const [shareCodeInput, setShareCodeInput] = useState('')
  const [csvInput, setCsvInput] = useState('')
  const [googleSheetUrl, setGoogleSheetUrl] = useState('')
  const [importDestination, setImportDestination] = useState<'dictionary' | 'existing' | 'new'>('dictionary')
  const [selectedListId, setSelectedListId] = useState<string>('')
  const [newListForImport, setNewListForImport] = useState('')
  const [addToDictionary, setAddToDictionary] = useState(true)

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

  const handleSelectSource = (source: 'wortschatz' | 'csv' | 'googlesheet') => {
    setImportSource(source)
    setShowSelectSourceModal(false)
    setShowImportModal(true)
  }

  const handleImportWortschatz = (e: React.FormEvent) => {
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

  const handleImportCSV = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!csvInput.trim()) return

    setCreating(true)
    setError(null)

    try {
      const response = await fetch('/api/words/import/csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvData: csvInput,
          destination: importDestination,
          listId: importDestination === 'existing' ? selectedListId : undefined,
          newListName: importDestination === 'new' ? newListForImport : undefined,
          addToDictionary,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to import CSV')
      }

      const data = await response.json()

      // Refresh lists
      await fetchLists()

      // Show success message
      alert(data.message)

      // Redirect to the list if one was created/selected
      if (data.listId) {
        router.push(`/lists/${data.listId}`)
      } else {
        // Close modal and refresh
        resetImportModal()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import CSV')
    } finally {
      setCreating(false)
    }
  }

  const handleImportGoogleSheet = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!googleSheetUrl.trim()) return

    setCreating(true)
    setError(null)

    try {
      const response = await fetch('/api/words/import/googlesheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          googleSheetUrl,
          destination: importDestination,
          listId: importDestination === 'existing' ? selectedListId : undefined,
          newListName: importDestination === 'new' ? newListForImport : undefined,
          addToDictionary,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to import Google Sheet')
      }

      const data = await response.json()

      // Refresh lists
      await fetchLists()

      // Show success message
      alert(data.message)

      // Redirect to the list if one was created/selected
      if (data.listId) {
        router.push(`/lists/${data.listId}`)
      } else {
        // Close modal and refresh
        resetImportModal()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import Google Sheet')
    } finally {
      setCreating(false)
    }
  }

  const resetImportModal = () => {
    setShowImportModal(false)
    setImportSource(null)
    setShareCodeInput('')
    setCsvInput('')
    setGoogleSheetUrl('')
    setImportDestination('dictionary')
    setSelectedListId('')
    setNewListForImport('')
    setAddToDictionary(true)
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My WortSchatz Lists</h1>
          <p className="text-gray-600">
            {lists.length} {lists.length === 1 ? 'list' : 'lists'}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowSelectSourceModal(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors font-medium flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Import Words
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors font-medium"
          >
            Create WS List
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
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Create New WS List</h2>

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

      {/* Select Source Modal */}
      {showSelectSourceModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowSelectSourceModal(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Select Import Source</h2>
            <p className="text-gray-600 mb-6">Choose where you want to import words from:</p>

            <div className="space-y-3">
              <button
                onClick={() => handleSelectSource('wortschatz')}
                className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group"
              >
                <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                  </svg>
                </div>
                <div className="text-left">
                  <div className="font-semibold text-gray-900">WortSchatz List</div>
                  <div className="text-sm text-gray-600">Import from a shared list code</div>
                </div>
              </button>

              <button
                onClick={() => handleSelectSource('csv')}
                className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-all group"
              >
                <div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="text-left">
                  <div className="font-semibold text-gray-900">CSV Data</div>
                  <div className="text-sm text-gray-600">Tab, comma, or semicolon delimited</div>
                </div>
              </button>

              <button
                onClick={() => handleSelectSource('googlesheet')}
                className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-all group"
              >
                <div className="flex-shrink-0 w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-200">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="text-left">
                  <div className="font-semibold text-gray-900">Google Sheet</div>
                  <div className="text-sm text-gray-600">Import via share link</div>
                </div>
              </button>
            </div>

            <button
              onClick={() => setShowSelectSourceModal(false)}
              className="w-full mt-4 bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300 transition-colors font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Import Modal - Dynamic based on source */}
      {showImportModal && importSource && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={resetImportModal}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {importSource === 'wortschatz' && 'Import WortSchatz List'}
              {importSource === 'csv' && 'Import CSV Data'}
              {importSource === 'googlesheet' && 'Import Google Sheet'}
            </h2>

            <form
              onSubmit={
                importSource === 'wortschatz' ? handleImportWortschatz :
                importSource === 'csv' ? handleImportCSV :
                handleImportGoogleSheet
              }
              className="space-y-4"
            >
              {/* WortSchatz List Import */}
              {importSource === 'wortschatz' && (
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                    autoFocus
                  />
                  <p className="mt-2 text-sm text-gray-500">
                    Paste either the share code (e.g., <code className="bg-gray-100 px-1 rounded">vhMGHzCGEg</code>) or the full share URL.
                  </p>
                </div>
              )}

              {/* CSV Import */}
              {importSource === 'csv' && (
                <div>
                  <label htmlFor="csvData" className="block text-sm font-medium text-gray-700 mb-1">
                    CSV Data
                  </label>
                  <textarea
                    id="csvData"
                    value={csvInput}
                    onChange={(e) => setCsvInput(e.target.value)}
                    placeholder="word1,translation1&#10;word2,translation2&#10;word3,translation3"
                    rows={8}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 font-mono text-sm resize-none"
                    required
                    autoFocus
                  />
                  <p className="mt-2 text-sm text-gray-500">
                    Paste your data using tabs, commas, or semicolons as delimiters. First column: foreign word, Second column: translation.
                  </p>
                </div>
              )}

              {/* Google Sheet Import */}
              {importSource === 'googlesheet' && (
                <div>
                  <label htmlFor="googleSheetUrl" className="block text-sm font-medium text-gray-700 mb-1">
                    Google Sheet Share Link
                  </label>
                  <input
                    id="googleSheetUrl"
                    type="url"
                    value={googleSheetUrl}
                    onChange={(e) => setGoogleSheetUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                    autoFocus
                  />
                  <p className="mt-2 text-sm text-gray-500">
                    Make sure the sheet is shared with view access. First column should be the foreign word, second column the translation.
                  </p>
                </div>
              )}

              {/* Add to Dictionary Checkbox */}
              {(importSource === 'csv' || importSource === 'googlesheet') && (
                <div className="border-t pt-4 mt-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={addToDictionary}
                      onChange={(e) => setAddToDictionary(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <div>
                      <div className="font-medium text-gray-900">Add to my dictionary</div>
                      <div className="text-sm text-gray-600">
                        Creates user_words entries for spaced repetition learning
                      </div>
                    </div>
                  </label>
                </div>
              )}

              {/* Destination Selection */}
              <div className="border-t pt-4 mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Where should these words go?
                </label>

                <div className="space-y-2">
                  <label className="flex items-center p-3 border rounded-md cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="destination"
                      value="dictionary"
                      checked={importDestination === 'dictionary'}
                      onChange={(e) => setImportDestination(e.target.value as any)}
                      className="mr-3"
                    />
                    <div>
                      <div className="font-medium">Add to Dictionary</div>
                      <div className="text-sm text-gray-600">Words will be added to your main dictionary only</div>
                    </div>
                  </label>

                  <label className="flex items-center p-3 border rounded-md cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="destination"
                      value="existing"
                      checked={importDestination === 'existing'}
                      onChange={(e) => setImportDestination(e.target.value as any)}
                      className="mr-3"
                    />
                    <div className="flex-1">
                      <div className="font-medium">Add to Existing List</div>
                      <div className="text-sm text-gray-600">Add to dictionary and an existing list</div>
                    </div>
                  </label>

                  {importDestination === 'existing' && (
                    <div className="ml-9 mt-2">
                      <select
                        value={selectedListId}
                        onChange={(e) => setSelectedListId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="">Select a list...</option>
                        {lists.map((list) => (
                          <option key={list.id} value={list.id}>
                            {list.name} ({list.itemCount || 0} words)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <label className="flex items-center p-3 border rounded-md cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="destination"
                      value="new"
                      checked={importDestination === 'new'}
                      onChange={(e) => setImportDestination(e.target.value as any)}
                      className="mr-3"
                    />
                    <div className="flex-1">
                      <div className="font-medium">Create New List</div>
                      <div className="text-sm text-gray-600">Add to dictionary and a new list</div>
                    </div>
                  </label>

                  {importDestination === 'new' && (
                    <div className="ml-9 mt-2">
                      <input
                        type="text"
                        value={newListForImport}
                        onChange={(e) => setNewListForImport(e.target.value)}
                        placeholder="New list name"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                  )}
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                  <p className="text-red-800 text-sm">{error}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetImportModal}
                  disabled={creating}
                  className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300 disabled:opacity-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {creating ? 'Importing...' : 'Import'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
