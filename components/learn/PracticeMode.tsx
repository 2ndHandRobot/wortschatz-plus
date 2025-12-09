'use client'

import { useState, useEffect } from 'react'
import { SessionType, UserWord } from '@/types/vocabulary'

interface PracticeModeProps {
  sessionType: SessionType
  wordId?: string | null
  onComplete: (sessionId: string) => void
  onBack: () => void
}

interface PracticeExercise {
  userWordId: string
  word: UserWord
  sentenceGerman: string
  sentenceEnglish: string
  targetWord: string
  difficulty: string
}

export default function PracticeMode({ sessionType, wordId, onComplete, onBack }: PracticeModeProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [exercises, setExercises] = useState<PracticeExercise[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [userTranslation, setUserTranslation] = useState('')
  const [showAnswer, setShowAnswer] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [evaluating, setEvaluating] = useState(false)
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
          mode: 'practice',
          wordId,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to start session')
      }

      const data = await response.json()
      setSessionId(data.sessionId)
      setExercises(data.exercises)
      setSessionStats({ correct: 0, incorrect: 0, total: data.exercises.length })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const currentExercise = exercises[currentIndex]

  const handleSubmit = async () => {
    if (!currentExercise || !userTranslation.trim()) return

    setEvaluating(true)
    setError(null)

    try {
      // Use Claude API to evaluate the translation
      const response = await fetch('/api/practice/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userTranslation: userTranslation.trim(),
          correctTranslation: currentExercise.sentenceGerman,
          englishPrompt: currentExercise.sentenceEnglish,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        const errorMsg = data.details ? `${data.error}: ${data.details}` : data.error
        throw new Error(errorMsg || 'Failed to evaluate translation')
      }

      const data = await response.json()
      setIsCorrect(data.isCorrect)
      setFeedback(data.feedback)
      setShowAnswer(true)

      // Update stats immediately when answer is revealed
      setSessionStats((prev) => ({
        ...prev,
        correct: prev.correct + (data.isCorrect ? 1 : 0),
        incorrect: prev.incorrect + (data.isCorrect ? 0 : 1),
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to evaluate translation')
    } finally {
      setEvaluating(false)
    }
  }

  const handleNext = async () => {
    if (!sessionId || !currentExercise || isCorrect === null) return

    try {
      await fetch('/api/sessions/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          userWordId: currentExercise.userWordId,
          mode: 'practice',
          correct: isCorrect,
        }),
      })

      // Reset for next question
      setUserTranslation('')
      setShowAnswer(false)
      setIsCorrect(null)
      setFeedback(null)

      if (currentIndex < exercises.length - 1) {
        setCurrentIndex(currentIndex + 1)
      } else {
        finishSession()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record answer')
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Generating practice exercises...</p>
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

  if (exercises.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-6 text-center">
          <p className="text-yellow-800 mb-4">
            No words ready for practice. Keep working through Revise and Recall modes!
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
          className="text-green-600 hover:text-green-800 mb-4 inline-flex items-center"
        >
          ← Exit session
        </button>
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Practice Mode</h1>
            <p className="text-gray-600 mt-1">
              Translate sentences using your vocabulary
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900">
              {currentIndex + 1} / {exercises.length}
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
            className="h-full bg-green-600 transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / exercises.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Exercise Card */}
      {currentExercise && (
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Translate to German:
              </h2>
              <span className="text-sm bg-gray-100 px-3 py-1 rounded">
                Focus: {currentExercise.targetWord}
              </span>
            </div>
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
              <p className="text-lg text-gray-900">
                {currentExercise.sentenceEnglish}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your German translation:
            </label>
            <textarea
              value={userTranslation}
              onChange={(e) => setUserTranslation(e.target.value)}
              disabled={showAnswer || evaluating}
              placeholder="Type your German translation here..."
              rows={3}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500 text-lg disabled:bg-gray-100 resize-none"
              autoFocus
            />
          </div>

          {showAnswer && (
            <div className={`mt-6 p-4 rounded-lg ${isCorrect ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
              <div className="mb-3">
                <span className={`font-semibold ${isCorrect ? 'text-green-800' : 'text-yellow-800'}`}>
                  {isCorrect ? '✓ Great job!' : '⚠ Could be improved'}
                </span>
              </div>

              <div className="space-y-2">
                <div>
                  <p className="text-sm font-semibold text-gray-700">Correct answer:</p>
                  <p className="text-gray-900">{currentExercise.sentenceGerman}</p>
                </div>

                {userTranslation && (
                  <div>
                    <p className="text-sm font-semibold text-gray-700">Your answer:</p>
                    <p className="text-gray-900">{userTranslation}</p>
                  </div>
                )}

                {feedback && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-sm font-semibold text-gray-700 mb-1">Feedback:</p>
                    <p className="text-gray-800 text-sm">{feedback}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-8">
        {!showAnswer ? (
          <button
            onClick={handleSubmit}
            disabled={!userTranslation.trim() || evaluating}
            className="w-full bg-green-600 text-white py-4 px-6 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-lg"
          >
            {evaluating ? 'Evaluating...' : 'Submit Translation'}
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="w-full bg-green-600 text-white py-4 px-6 rounded-lg hover:bg-green-700 transition-colors font-medium text-lg"
          >
            {currentIndex < exercises.length - 1 ? 'Next Exercise →' : 'Finish Session'}
          </button>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-8 bg-green-50 border border-green-200 rounded-lg p-4">
        <h3 className="font-semibold text-green-900 mb-2">How to use Practice Mode:</h3>
        <ul className="text-sm text-green-800 space-y-1">
          <li>• Translate the English sentence to German</li>
          <li>• Focus on using the target word correctly</li>
          <li>• AI will evaluate your translation for accuracy</li>
          <li>• You'll get detailed feedback on your answer</li>
        </ul>
      </div>
    </div>
  )
}
