'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface SessionSummaryProps {
  sessionId: string
  onBack: () => void
}

interface SessionStats {
  sessionType: string
  mode: string
  totalItems: number
  correctItems: number
  incorrectItems: number
  durationSeconds: number
  startedAt: string
  completedAt: string
  wordsMovedUp: number
  wordsMovedDown: number
}

export default function SessionSummary({ sessionId, onBack }: SessionSummaryProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<SessionStats | null>(null)

  useEffect(() => {
    loadStats()
  }, [sessionId])

  const loadStats = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/sessions/${sessionId}/stats`)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to load session stats')
      }

      const data = await response.json()
      setStats(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading session summary...</p>
        </div>
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">{error || 'Failed to load session stats'}</p>
          <button
            onClick={onBack}
            className="mt-4 text-red-600 hover:text-red-800 font-medium"
          >
            ← Back to mode selection
          </button>
        </div>
      </div>
    )
  }

  const accuracy = stats.totalItems > 0
    ? Math.round((stats.correctItems / stats.totalItems) * 100)
    : 0

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}m ${secs}s`
  }

  const getModeColor = (mode: string) => {
    switch (mode) {
      case 'revise': return 'blue'
      case 'recall': return 'purple'
      case 'practice': return 'green'
      default: return 'gray'
    }
  }

  const color = getModeColor(stats.mode)

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      {/* Celebration Header */}
      <div className="text-center mb-8">
        <div className="text-6xl mb-4">🎉</div>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          Session Complete!
        </h1>
        <p className="text-lg text-gray-600">
          Great work on your {stats.mode} session
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Accuracy Card */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-sm font-semibold text-gray-600 mb-2">Accuracy</h3>
          <div className="flex items-baseline">
            <span className={`text-5xl font-bold text-${color}-600`}>{accuracy}%</span>
          </div>
          <div className="mt-4 flex justify-between text-sm text-gray-600">
            <span>✓ {stats.correctItems} correct</span>
            <span>✗ {stats.incorrectItems} incorrect</span>
          </div>
        </div>

        {/* Duration Card */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-sm font-semibold text-gray-600 mb-2">Duration</h3>
          <div className="flex items-baseline">
            <span className="text-5xl font-bold text-gray-900">
              {formatDuration(stats.durationSeconds)}
            </span>
          </div>
          <div className="mt-4 text-sm text-gray-600">
            {stats.totalItems} words practiced
          </div>
        </div>

        {/* Progress Card */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-sm font-semibold text-gray-600 mb-2">Progress</h3>
          <div className="space-y-2">
            {stats.wordsMovedUp > 0 && (
              <div className="flex items-center text-green-600">
                <span className="text-2xl mr-2">↑</span>
                <span className="text-lg font-semibold">
                  {stats.wordsMovedUp} word{stats.wordsMovedUp !== 1 ? 's' : ''} advanced
                </span>
              </div>
            )}
            {stats.wordsMovedDown > 0 && (
              <div className="flex items-center text-orange-600">
                <span className="text-2xl mr-2">↓</span>
                <span className="text-lg font-semibold">
                  {stats.wordsMovedDown} word{stats.wordsMovedDown !== 1 ? 's' : ''} need more practice
                </span>
              </div>
            )}
            {stats.wordsMovedUp === 0 && stats.wordsMovedDown === 0 && (
              <div className="text-gray-600">
                Keep practicing to see progress!
              </div>
            )}
          </div>
        </div>

        {/* Session Type Card */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-sm font-semibold text-gray-600 mb-2">Session Type</h3>
          <div className="space-y-2">
            <div className={`inline-block bg-${color}-100 text-${color}-800 px-3 py-1 rounded-full text-sm font-semibold capitalize`}>
              {stats.mode} Mode
            </div>
            <div className="text-gray-600 capitalize text-sm">
              {stats.sessionType} Session
            </div>
          </div>
        </div>
      </div>

      {/* Encouragement Message */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 mb-8">
        <h3 className="font-semibold text-gray-900 mb-2">
          {accuracy >= 80
            ? "Excellent work! You're making great progress!"
            : accuracy >= 60
            ? "Good job! Keep practicing to improve even more!"
            : "Keep it up! Consistent practice is the key to mastery!"}
        </h3>
        <p className="text-gray-700 text-sm">
          {stats.mode === 'revise' && "Continue practicing to move words to Recall mode."}
          {stats.mode === 'recall' && "Successfully recalled words will move to Practice mode."}
          {stats.mode === 'practice' && "Mastered words will be scheduled for spaced repetition review."}
        </p>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={onBack}
          className={`bg-${color}-600 text-white py-3 px-6 rounded-lg hover:bg-${color}-700 transition-colors font-medium`}
        >
          Practice Again
        </button>
        <Link
          href="/dictionary"
          className="bg-gray-200 text-gray-700 py-3 px-6 rounded-lg hover:bg-gray-300 transition-colors font-medium text-center"
        >
          View Dictionary
        </Link>
        <Link
          href="/"
          className="bg-gray-200 text-gray-700 py-3 px-6 rounded-lg hover:bg-gray-300 transition-colors font-medium text-center"
        >
          Add More Words
        </Link>
      </div>
    </div>
  )
}
