'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { UserWord, VocabularyEntry, UserTag, WordTag, WordList } from '@/types/vocabulary'
import WordCard from '@/components/learn/WordCard'
import WordEditForm from '@/components/vocabulary/WordEditForm'
import { mapUserWordFromDb, getTargetWord } from '@/lib/vocabulary-utils'
import TagBadge from '@/components/tags/TagBadge'
import { dictionaryCache } from '@/lib/dictionary-cache'

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
  const [allTags, setAllTags] = useState<UserTag[]>([])
  const [wordTags, setWordTags] = useState<Map<string, WordTag[]>>(new Map())
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set())
  const [showAddToList, setShowAddToList] = useState(false)
  const [userLists, setUserLists] = useState<WordList[]>([])
  const [addingToList, setAddingToList] = useState(false)
  const [showManageTags, setShowManageTags] = useState(false)
  const [managingTags, setManagingTags] = useState(false)
  const [wordListMemberships, setWordListMemberships] = useState<Map<string, string[]>>(new Map())
  const [selectedListId, setSelectedListId] = useState<string>('')
  const [loadingListFilter, setLoadingListFilter] = useState(false)
  const [showCreateTag, setShowCreateTag] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagCategory, setNewTagCategory] = useState<'thematic' | 'situational' | 'custom'>('custom')
  const [creatingTag, setCreatingTag] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchUserLanguage()
    fetchTags()
  }, [])

  useEffect(() => {
    if (targetLanguage) {
      fetchWords()
      fetchUserLists()
    }
  }, [targetLanguage])

  useEffect(() => {
    if (selectedListId && !wordListMemberships.has(selectedListId)) {
      fetchListMembership(selectedListId)
    }
  }, [selectedListId])

  // useEffect(() => {
  //   if (selectedListId) {
  //     console.log("selectedListId: ",selectedListId)
  //   }
  // }, [selectedListId])

  useEffect(() => {
    // Load list memberships for all lists when word detail modal is opened
    if (selectedWord && userLists.length > 0) {
      userLists.forEach((list) => {
        if (!wordListMemberships.has(list.id)) {
          fetchListMembership(list.id)
        }
      })
    }
  }, [selectedWord, userLists])

  useEffect(() => {
    // Load all list memberships when lists are fetched (for word card display)
    if (userLists.length > 0 && words.length > 0) {
      userLists.forEach((list) => {
        if (!wordListMemberships.has(list.id)) {
          fetchListMembership(list.id)
        }
      })
    }
  }, [userLists, words])

  const fetchTags = async () => {
    try {
      const response = await fetch('/api/tags')
      if (!response.ok) return
      const data = await response.json()
      setAllTags(data.tags || [])
    } catch (err) {
      console.error('Failed to fetch tags:', err)
    }
  }

  const fetchUserLists = async () => {
    try {
      const response = await fetch('/api/lists')
      if (!response.ok) return
      const data = await response.json()
      // Filter lists by target language
      const filteredLists = (data.lists || []).filter((list: WordList) =>
        list.language === targetLanguage
      )
      setUserLists(filteredLists)
    } catch (err) {
      console.error('Failed to fetch lists:', err)
    }
  }

  const fetchListMembership = async (listId: string) => {
    try {
      setLoadingListFilter(true)
      // const response = await fetch(`/api/lists/${listId}/items`)
      const response = await fetch(`/api/lists/${listId}`)
      if (!response.ok) return
      const data = await response.json()
      const items = data.list?.items || []

      // Debug: log raw item structure
      if (items.length > 0) {
        console.log('First item structure:', items[0])
        console.log('First item keys:', Object.keys(items[0]))
      }

      // Extract vocabulary IDs - check nested vocabulary object first
      const vocabularyIds = items.map((item: any) => {
        // Try nested vocabulary object first (this is the correct structure)
        if (item.vocabulary?.id) return item.vocabulary.id
        // Fallback to direct fields
        return item.vocabularyId || item.vocabulary_id
      }).filter(Boolean)

      console.log('Fetched list membership:', { listId, itemCount: items.length, vocabularyIds })

      const newMemberships = new Map(wordListMemberships)
      newMemberships.set(listId, vocabularyIds)
      setWordListMemberships(newMemberships)
    } catch (err) {
      console.error('Failed to fetch list membership:', err)
    } finally {
      setLoadingListFilter(false)
    }
  }

  const fetchWordListMemberships = async (vocabularyId: string) => {
    try {
      // Fetch all lists to check which ones contain this word
      const response = await fetch('/api/lists')
      if (!response.ok) return []
      const data = await response.json()
      const allLists = (data.lists || []).filter((list: WordList) =>
        list.language === targetLanguage
      )

      // Check each list to see if it contains this word
      const memberships: WordList[] = []
      await Promise.all(
        allLists.map(async (list: WordList) => {
          const listResponse = await fetch(`/api/lists/${list.id}`)
          if (listResponse.ok) {
            const listData = await listResponse.json()
            const items = listData.list?.items || []
            if (items.some((item: any) => item.vocabularyId === vocabularyId)) {
              memberships.push(list)
            }
          }
        })
      )
      return memberships
    } catch (err) {
      console.error('Failed to fetch word list memberships:', err)
      return []
    }
  }

  const handleToggleTag = async (tagId: string) => {
    if (!selectedWord) return

    const userWord = words.find(w => w.vocabulary?.id === selectedWord.id)
    if (!userWord) return

    setManagingTags(true)
    const currentTags = wordTags.get(userWord.id) || []
    const hasTag = currentTags.some(wt => wt.tagId === tagId)

    try {
      if (hasTag) {
        // Remove tag
        const response = await fetch(`/api/words/${userWord.id}/tags?tagId=${tagId}`, {
          method: 'DELETE',
        })

        if (!response.ok) throw new Error('Failed to remove tag')

        // Update local state
        const updatedTags = currentTags.filter(wt => wt.tagId !== tagId)
        const newTagsMap = new Map(wordTags)
        newTagsMap.set(userWord.id, updatedTags)
        setWordTags(newTagsMap)

        // Update cache with new tags
        if (targetLanguage) {
          await dictionaryCache.updateWordTags(targetLanguage, userWord.id, updatedTags)
        }
      } else {
        // Add tag
        const response = await fetch(`/api/words/${userWord.id}/tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tagId }),
        })

        if (!response.ok) {
          const result = await response.json()
          throw new Error(result.error || 'Failed to add tag')
        }

        const result = await response.json()

        // Update local state
        const updatedTags = [...currentTags, result.wordTag]
        const newTagsMap = new Map(wordTags)
        newTagsMap.set(userWord.id, updatedTags)
        setWordTags(newTagsMap)

        // Update cache with new tags
        if (targetLanguage) {
          await dictionaryCache.updateWordTags(targetLanguage, userWord.id, updatedTags)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update tags')
    } finally {
      setManagingTags(false)
    }
  }

  const handleCreateTag = async () => {
    const trimmedName = newTagName.trim()
    if (!trimmedName) return

    setCreatingTag(true)
    try {
      const response = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          category: newTagCategory,
        }),
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || 'Failed to create tag')
      }

      const result = await response.json()

      // Add new tag to allTags list
      setAllTags([...allTags, result.tag])

      // Reset form
      setNewTagName('')
      setNewTagCategory('custom')
      setShowCreateTag(false)

      // If in Word Details modal, automatically apply the new tag
      if (selectedWord) {
        const userWord = words.find(w => w.vocabulary?.id === selectedWord.id)
        if (userWord) {
          await handleToggleTag(result.tag.id)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tag')
    } finally {
      setCreatingTag(false)
    }
  }

  const handleAddToList = async (listId: string) => {
    if (!selectedWord) return

    setAddingToList(true)
    try {
      const response = await fetch(`/api/lists/${listId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vocabularyId: selectedWord.id }),
      })

      const result = await response.json()

      if (!response.ok) {
        if (response.status === 409) {
          setEnrichMessage('Word is already in this list')
        } else {
          throw new Error(result.error || 'Failed to add word to list')
        }
      } else {
        setEnrichMessage(`Added to list successfully!`)
        setShowAddToList(false)
      }

      setTimeout(() => setEnrichMessage(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add word to list')
    } finally {
      setAddingToList(false)
    }
  }

  const fetchWordTags = async (userWordIds: string[]) => {
    try {
      const tagsMap = new Map<string, WordTag[]>()

      await Promise.all(
        userWordIds.map(async (userWordId) => {
          const response = await fetch(`/api/words/${userWordId}/tags`)
          if (response.ok) {
            const data = await response.json()
            tagsMap.set(userWordId, data.wordTags || [])
          }
        })
      )

      setWordTags(tagsMap)
      return tagsMap // Return the map so caller can use it for caching
    } catch (err) {
      console.error('Failed to fetch word tags:', err)
      return new Map<string, WordTag[]>()
    }
  }

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

  const invalidateCache = () => {
    if (!targetLanguage) return
    dictionaryCache.invalidate(targetLanguage)
  }

  const fetchWords = async (forceRefresh = false) => {
    if (!targetLanguage) return

    // Try to use cache first (unless force refresh)
    if (!forceRefresh) {
      try {
        const cached = await dictionaryCache.get(targetLanguage)
        if (cached) {
          setWords(cached.words)
          setWordTags(cached.wordTags)
          setLoading(false)
          return
        }
      } catch (err) {
        console.error('Cache read error:', err)
      }
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      console.log('🔄 Fetching fresh dictionary data from database')

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

      // Fetch tags for all words
      const userWordIds = sortedData.map(w => w.id)
      let fetchedTagsMap = new Map<string, WordTag[]>()
      if (userWordIds.length > 0) {
        fetchedTagsMap = await fetchWordTags(userWordIds)
      }

      // Save to cache
      try {
        await dictionaryCache.set(targetLanguage, sortedData, fetchedTagsMap)
      } catch (err) {
        console.error('Cache write error:', err)
      }
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

      // Invalidate cache and refresh the words list to show updated data
      invalidateCache()
      await fetchWords(true)
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
      const updatedUserWord = words.find(w => w.vocabulary?.id === updatedWord.id)
      if (updatedUserWord && targetLanguage) {
        const newUserWord = { ...updatedUserWord, vocabulary: result.word }

        // Update cache with the modified word
        await dictionaryCache.updateWord(targetLanguage, newUserWord)

        // Update local state
        setWords(prevWords =>
          prevWords.map(w =>
            w.vocabulary?.id === updatedWord.id ? newUserWord : w
          )
        )
      } else {
        // Fallback: update local state only
        setWords(prevWords =>
          prevWords.map(w =>
            w.vocabulary?.id === updatedWord.id
              ? { ...w, vocabulary: result.word }
              : w
          )
        )
      }

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

      // Update cache to remove the word
      if (targetLanguage) {
        await dictionaryCache.removeWord(targetLanguage, userWord.id)
      }

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

  // Filter words based on search query, selected tags, and selected list
  const filterWords = () => {
    let filtered = words

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((word) => {
        if (!word.vocabulary) return false
        const vocab = word.vocabulary
        return getTargetWord(vocab).toLowerCase().includes(query)
      })
    }

    // Filter by selected tags
    if (selectedTagIds.size > 0) {
      filtered = filtered.filter((word) => {
        const tags = wordTags.get(word.id) || []
        // Word must have at least one of the selected tags
        return tags.some(wt => selectedTagIds.has(wt.tagId))
      })
    }

    // Filter by selected list
    if (selectedListId) {
      const listMemberships = wordListMemberships.get(selectedListId)
      console.log('Filtering by list:', { selectedListId, listMemberships, wordsCount: filtered.length })
      // Only apply filter if we have loaded the membership data
      if (listMemberships && listMemberships.length > 0) {
        const beforeFilterCount = filtered.length
        filtered = filtered.filter((word) => {
          if (!word.vocabulary) return false
          const isIncluded = listMemberships.includes(word.vocabulary.id)
          if (beforeFilterCount <= 5) {
            console.log('Checking word:', { wordId: word.vocabulary.id, isIncluded })
          }
          return isIncluded
        })
        console.log('After list filter:', { filtered: filtered.length, expected: listMemberships.length })
      }
    }

    return filtered
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
          <button
            onClick={() => {
              invalidateCache()
              setLoading(true)
              fetchWords(true)
            }}
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 transition-colors flex items-center gap-2"
            title="Refresh dictionary"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        {/* Search Bar and Filters - Sticky */}
        <div className="sticky top-0 z-20 bg-gray-50 pt-4 pb-2 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
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

        {/* Filters Section */}
        <div className="mt-4 space-y-3">
          {/* Jump to Letter Dropdown */}
          <div className="flex items-center gap-3">
            <label htmlFor="jumpTo" className="text-sm font-medium text-gray-700 whitespace-nowrap">
              Jump to:
            </label>
            <select
              id="jumpTo"
              onChange={(e) => {
                if (e.target.value) {
                  document.getElementById(`letter-${e.target.value}`)?.scrollIntoView({ behavior: 'smooth' })
                }
              }}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">Select letter...</option>
              {groupWordsByLetter().map(({ letter }) => (
                <option key={letter} value={letter}>
                  {letter}
                </option>
              ))}
            </select>

            {/* List Filter Dropdown */}
            <label htmlFor="listFilter" className="text-sm font-medium text-gray-700 whitespace-nowrap ml-4">
              Filter by list:
            </label>
            <select
              id="listFilter"
              value={selectedListId}
              onChange={(e) => setSelectedListId(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              disabled={loadingListFilter}
            >
              <option value="">---</option>
              {userLists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name} ({list.itemCount || 0} words)
                </option>
              ))}
            </select>

            {/* Tag Filter - on same line on desktop */}
            {allTags.length > 0 && (
              <>
                <span className="text-sm font-medium text-gray-700 whitespace-nowrap ml-4">Filter by tags:</span>
                {allTags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => {
                      const newSelected = new Set(selectedTagIds)
                      if (newSelected.has(tag.id)) {
                        newSelected.delete(tag.id)
                      } else {
                        newSelected.add(tag.id)
                      }
                      setSelectedTagIds(newSelected)
                    }}
                    className={`transition-opacity ${
                      selectedTagIds.has(tag.id) ? 'opacity-100 ring-2 ring-blue-500' : 'opacity-60 hover:opacity-100'
                    }`}
                  >
                    <TagBadge tag={tag} size="sm" />
                  </button>
                ))}
                {selectedTagIds.size > 0 && (
                  <button
                    onClick={() => setSelectedTagIds(new Set())}
                    className="text-sm text-blue-600 hover:text-blue-800 underline"
                  >
                    Clear tag filters
                  </button>
                )}
              </>
            )}
          </div>
        </div>
        {/* End Sticky Section */}

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
                {searchQuery.trim()
                  ? `No words found matching "${searchQuery}"`
                  : selectedListId
                    ? `No words found in the selected list${loadingListFilter ? ' (loading...)' : ''}`
                    : selectedTagIds.size > 0
                      ? 'No words found with the selected tags'
                      : 'No words found'
                }
              </p>
              <div className="flex gap-2 justify-center">
                {searchQuery.trim() && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-blue-600 hover:text-blue-700 text-sm"
                  >
                    Clear search
                  </button>
                )}
                {selectedListId && (
                  <button
                    onClick={() => setSelectedListId('')}
                    className="text-blue-600 hover:text-blue-700 text-sm"
                  >
                    Clear list filter
                  </button>
                )}
                {selectedTagIds.size > 0 && (
                  <button
                    onClick={() => setSelectedTagIds(new Set())}
                    className="text-blue-600 hover:text-blue-700 text-sm"
                  >
                    Clear tag filters
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-8">
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

                      {/* Tags and Lists at bottom */}
                      <div className="mt-4 pt-4 border-t space-y-3">
                        {/* Tags */}
                        <div>
                          <h5 className="text-xs font-semibold text-gray-500 uppercase mb-2">Tags</h5>
                          <div className="flex flex-wrap gap-2">
                            {wordTags.get(userWord.id)?.length ? (
                              wordTags.get(userWord.id)?.map((wordTag) => (
                                wordTag.tag && (
                                  <TagBadge key={wordTag.id} tag={wordTag.tag} size="sm" />
                                )
                              ))
                            ) : (
                              <span className="text-xs text-gray-400">No tags</span>
                            )}
                          </div>
                        </div>

                        {/* Lists */}
                        <div>
                          <h5 className="text-xs font-semibold text-gray-500 uppercase mb-2">Lists</h5>
                          <div className="flex flex-wrap gap-2">
                            {(() => {
                              const wordLists: string[] = []
                              userLists.forEach((list) => {
                                const listVocabIds = wordListMemberships.get(list.id) || []
                                if (listVocabIds.includes(vocab.id)) {
                                  wordLists.push(list.name)
                                }
                              })
                              return wordLists.length > 0 ? (
                                wordLists.map((listName, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-block px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-800"
                                  >
                                    {listName}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-gray-400">No lists</span>
                              )
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
                ))}
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
              <div className="bg-white px-8 pb-6 rounded-b-lg -mt-2 space-y-4">
                {/* Tags and Lists Display */}
                {(() => {
                  const userWord = words.find(w => w.vocabulary?.id === selectedWord.id)
                  if (!userWord) return null
                  const currentTags = wordTags.get(userWord.id) || []
                  return (
                    <div className="pt-2 pb-3 border-b space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-semibold text-gray-700">Tags</h4>
                          <button
                            onClick={() => {
                              setShowManageTags(!showManageTags)
                              if (showManageTags) {
                                setShowCreateTag(false)
                                setNewTagName('')
                              }
                            }}
                            className="text-sm text-blue-600 hover:text-blue-800"
                          >
                            {showManageTags ? 'Done' : 'Manage'}
                          </button>
                        </div>
                        {showManageTags ? (
                          <div className="space-y-3">
                            {/* Create Tag Form */}
                            {showCreateTag ? (
                              <div className="border rounded-lg p-3 bg-gray-50">
                                <div className="space-y-2">
                                  <input
                                    type="text"
                                    value={newTagName}
                                    onChange={(e) => setNewTagName(e.target.value)}
                                    placeholder="Tag name..."
                                    className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault()
                                        handleCreateTag()
                                      } else if (e.key === 'Escape') {
                                        setShowCreateTag(false)
                                        setNewTagName('')
                                      }
                                    }}
                                    autoFocus
                                  />
                                  <div className="flex items-center gap-2">
                                    <select
                                      value={newTagCategory}
                                      onChange={(e) => setNewTagCategory(e.target.value as 'thematic' | 'situational' | 'custom')}
                                      className="flex-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                      <option value="custom">Custom</option>
                                      <option value="thematic">Thematic</option>
                                      <option value="situational">Situational</option>
                                    </select>
                                    <button
                                      onClick={handleCreateTag}
                                      disabled={!newTagName.trim() || creatingTag}
                                      className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      {creatingTag ? 'Creating...' : 'Create'}
                                    </button>
                                    <button
                                      onClick={() => {
                                        setShowCreateTag(false)
                                        setNewTagName('')
                                      }}
                                      className="px-4 py-2 border rounded-md text-sm font-medium hover:bg-gray-100"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => setShowCreateTag(true)}
                                className="w-full px-3 py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Create New Tag
                              </button>
                            )}

                            {/* Existing Tags */}
                            {allTags.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {allTags.map((tag) => {
                                  const isApplied = currentTags.some(wt => wt.tagId === tag.id)
                                  return (
                                    <button
                                      key={tag.id}
                                      onClick={() => handleToggleTag(tag.id)}
                                      disabled={managingTags}
                                      className={`transition-all ${isApplied ? 'ring-2 ring-blue-500' : 'opacity-60 hover:opacity-100'}`}
                                    >
                                      <TagBadge tag={tag} size="sm" />
                                    </button>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {currentTags.length === 0 ? (
                              <p className="text-sm text-gray-500">No tags</p>
                            ) : (
                              currentTags.map((wt) => wt.tag && <TagBadge key={wt.id} tag={wt.tag} size="sm" />)
                            )}
                          </div>
                        )}
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">In Lists</h4>
                        <div className="flex flex-wrap gap-2">
                          {(() => {
                            const listMemberships: string[] = []
                            userLists.forEach((list) => {
                              const listVocabIds = wordListMemberships.get(list.id) || []
                              if (listVocabIds.includes(selectedWord.id)) {
                                listMemberships.push(list.name)
                              }
                            })
                            return listMemberships.length === 0 ? (
                              <p className="text-sm text-gray-500">Not in any lists</p>
                            ) : (
                              listMemberships.map((listName, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800"
                                >
                                  {listName}
                                </span>
                              ))
                            )
                          })()}
                        </div>
                      </div>
                    </div>
                  )
                })()}
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
                  onClick={() => {
                    fetchUserLists()
                    setShowAddToList(true)
                  }}
                  className="w-full bg-green-600 text-white py-3 px-6 rounded-md hover:bg-green-700 transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Add to List
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

      {/* Add to List Modal */}
      {showAddToList && selectedWord && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => !addingToList && setShowAddToList(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-gray-900 mb-4">Add to List</h3>
            <p className="text-gray-600 mb-4">
              Choose a list for <span className="font-semibold">"{getTargetWord(selectedWord)}"</span>
            </p>

            {userLists.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600 mb-4">
                  You don't have any {targetLanguage} lists yet.
                </p>
                <a
                  href="/lists"
                  className="inline-block bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                  Create a List
                </a>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {userLists.map((list) => (
                  <button
                    key={list.id}
                    onClick={() => handleAddToList(list.id)}
                    disabled={addingToList}
                    className="w-full text-left p-4 border border-gray-200 rounded-md hover:bg-blue-50 hover:border-blue-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="font-medium text-gray-900">{list.name}</div>
                    {list.description && (
                      <div className="text-sm text-gray-600 mt-1">{list.description}</div>
                    )}
                    <div className="text-xs text-gray-500 mt-1">
                      {list.itemCount || 0} {list.itemCount === 1 ? 'word' : 'words'}
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="mt-4">
              <button
                onClick={() => setShowAddToList(false)}
                disabled={addingToList}
                className="w-full bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300 disabled:opacity-50 transition-colors font-medium"
              >
                {addingToList ? 'Adding...' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
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
