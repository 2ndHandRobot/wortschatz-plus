'use client'

import { useState, useEffect } from 'react'
import { SessionType, UserWord, WordInfoItem } from '@/types/vocabulary'
import WordCard from './WordCard'

interface ReviseModeProps {
  sessionType: SessionType
  wordId?: string | null
  wordIds?: string[] | null
  onComplete: (sessionId: string) => void
  onBack: () => void
}

export default function ReviseMode({ sessionType, wordId, wordIds, onComplete, onBack }: ReviseModeProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [words, setWords] = useState<UserWord[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [hiddenItems, setHiddenItems] = useState<Set<string>>(new Set())
  const [showingAnswer, setShowingAnswer] = useState(false)
  const [testedItem, setTestedItem] = useState<string | null>(null)
  const [sessionStats, setSessionStats] = useState({
    correct: 0,
    incorrect: 0,
    total: 0,
  })

  useEffect(() => {
    loadSession()
  }, [])

  const loadSession = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/sessions/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionType,
          mode: 'revise',
          wordId,
          wordIds,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to start session')
      }

      const data = await response.json()
      setSessionId(data.sessionId)
      setWords(data.words)
      setSessionStats({ correct: 0, incorrect: 0, total: data.words.length })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const currentWord = words[currentIndex]

  // Get all available info keys for the current word
  const getAvailableInfoKeys = (): string[] => {
    if (!currentWord || !currentWord.vocabulary) return []

    const word = currentWord.vocabulary
    const keys: string[] = []

    // Always available
    if (word.english && word.english.length > 0) keys.push('english')

    // Type-specific fields
    if (word.type === 'noun') {
      if ('article' in word && word.article) keys.push('article')
      if ('gender' in word && word.gender) keys.push('gender')
      if ('plural' in word && word.plural) keys.push('plural')
      if ('genitive' in word && word.genitive) keys.push('genitive')
    }

    if (word.type === 'verb') {
      if ('auxiliary' in word && word.auxiliary) keys.push('auxiliary')
      if (word.conjugation?.perfect) keys.push('perfect')
      if (word.separable?.isSeparable && word.separable.prefix) keys.push('separable_prefix')
    }

    if (word.type === 'adjective') {
      if ('comparative' in word && word.comparative) keys.push('comparative')
      if ('superlative' in word && word.superlative) keys.push('superlative')
    }

    return keys
  }

  const handleTest = () => {
    if (testedItem !== null) {
      // Reset/end the test
      setHiddenItems(new Set())
      setTestedItem(null)
    } else {
      // Start a new test
      const availableKeys = getAvailableInfoKeys()
      if (availableKeys.length === 0) return

      // Pick a random key
      const randomIndex = Math.floor(Math.random() * availableKeys.length)
      const randomKey = availableKeys[randomIndex]

      // Hide it and mark as tested
      setHiddenItems(new Set([randomKey]))
      setTestedItem(randomKey)
    }
  }

  const handleToggleInfo = (infoKey: string) => {
    // Only allow toggling if we're in test mode and clicking the tested item
    if (testedItem !== null && infoKey === testedItem) {
      const availableKeys = getAvailableInfoKeys()

      // Remove the current key from available keys since we're revealing it
      const remainingKeys = availableKeys.filter(key => key !== infoKey && !hiddenItems.has(key))

      setHiddenItems((prev) => {
        const next = new Set(prev)

        // Reveal the clicked item
        if (next.has(infoKey)) {
          next.delete(infoKey)
        }

        // Hide another random item if available
        if (remainingKeys.length > 0) {
          const randomIndex = Math.floor(Math.random() * remainingKeys.length)
          const randomKey = remainingKeys[randomIndex]
          next.add(randomKey)
          setTestedItem(randomKey) // Update the tested item to the newly hidden one
        } else {
          // No more items to hide, end the test
          setTestedItem(null)
        }

        return next
      })
    }
  }

  const handleMarkCorrect = async () => {
    if (!sessionId || !currentWord) return

    try {
      await fetch('/api/sessions/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          userWordId: currentWord.id,
          mode: 'revise',
          correct: true,
        }),
      })

      setSessionStats((prev) => ({ ...prev, correct: prev.correct + 1 }))
      moveToNext()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record answer')
    }
  }

  const handleMarkIncorrect = async () => {
    if (!sessionId || !currentWord) return

    try {
      await fetch('/api/sessions/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          userWordId: currentWord.id,
          mode: 'revise',
          correct: false,
        }),
      })

      setSessionStats((prev) => ({ ...prev, incorrect: prev.incorrect + 1 }))
      moveToNext()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record answer')
    }
  }

  const moveToNext = () => {
    setHiddenItems(new Set())
    setShowingAnswer(false)
    setTestedItem(null)

    if (currentIndex < words.length - 1) {
      setCurrentIndex(currentIndex + 1)
    } else {
      finishSession()
    }
  }

  const handleExit = async () => {
    if (!sessionId) {
      onBack()
      return
    }

    // If we've started answering questions, complete the session
    if (sessionStats.correct > 0 || sessionStats.incorrect > 0) {
      await finishSession()
    } else {
      // No progress made, just go back
      onBack()
    }
  }

  const finishSession = async () => {
    if (!sessionId) return

    try {
      await fetch('/api/sessions/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })

      onComplete(sessionId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete session')
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading session...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">{error}</p>
          <button
            onClick={handleExit}
            className="mt-4 text-red-600 hover:text-red-800 font-medium"
          >
            ← Exit session
          </button>
        </div>
      </div>
    )
  }

  if (words.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-6 text-center">
          <p className="text-yellow-800 mb-4">
            No words available for revision. Add some words to your dictionary first!
          </p>
          <button
            onClick={handleExit}
            className="text-yellow-600 hover:text-yellow-800 font-medium"
          >
            ← Exit session
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={handleExit}
          className="text-blue-600 hover:text-blue-800 mb-4 inline-flex items-center"
        >
          ← Exit session
        </button>
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Revise Mode</h1>
            <p className="text-gray-600 mt-1">
              Test your recall by hiding word details
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900">
              {currentIndex + 1} / {words.length}
            </div>
            <div className="text-sm text-gray-600">
              ✓ {sessionStats.correct} • ✗ {sessionStats.incorrect}
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-8">
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / words.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Word Card */}
      {currentWord && currentWord.vocabulary && (
        <WordCard
          word={currentWord.vocabulary}
          hiddenItems={hiddenItems}
          onToggleInfo={handleToggleInfo}
          mode="revise"
          headerButton={
            <div className="flex gap-2">
              <button
                onClick={handleTest}
                className={`py-4 px-4 rounded-lg transition-colors font-medium text-sm ${
                  testedItem === null
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-600 text-white hover:bg-gray-700'
                }`}
              >
                {testedItem === null ? 'Test Me' : 'End Test'}
              </button>
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleMarkCorrect}
                  className="bg-green-600 text-white py-1.5 px-4 rounded-lg hover:bg-green-700 transition-colors font-medium text-sm"
                >
                  ✓ Learned
                </button>
                <button
                  onClick={handleMarkIncorrect}
                  className="bg-orange-600 text-white py-1.5 px-4 rounded-lg hover:bg-orange-700 transition-colors font-medium text-sm"
                >
                  ↻ Revise Later
                </button>
              </div>
            </div>
          }
        />
      )}

      {/* Instructions */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">How to use Revise Mode:</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Click "Test Me" to hide a random field</li>
          <li>• Try to recall the hidden information, then click it to reveal</li>
          <li>• Each time you reveal a field, another random field will be hidden</li>
          <li>• Click "End Test" to reveal all fields</li>
          <li>• Mark as "Learned" if you know the word well, or "Revise Later" to practice again</li>
        </ul>
      </div>
    </div>
  )
}
