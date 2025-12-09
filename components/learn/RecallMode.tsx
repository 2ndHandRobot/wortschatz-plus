'use client'

import { useState, useEffect, useRef } from 'react'
import { SessionType, UserWord } from '@/types/vocabulary'

interface RecallModeProps {
  sessionType: SessionType
  wordId?: string | null
  onComplete: (sessionId: string) => void
  onBack: () => void
}

interface RecallExercise {
  userWordId: string
  word: UserWord
  exerciseType: 'fill_blank' | 'multiple_choice'
  question: string
  answer: string
  options?: string[]
  context?: string
}

export default function RecallMode({ sessionType, wordId, onComplete, onBack }: RecallModeProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [exercises, setExercises] = useState<RecallExercise[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [userAnswer, setUserAnswer] = useState('')
  const [showAnswer, setShowAnswer] = useState(false)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [sessionStats, setSessionStats] = useState({
    correct: 0,
    incorrect: 0,
    total: 0,
  })
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadSession()
  }, [])

  // Focus input field when showAnswer becomes false (new question)
  useEffect(() => {
    if (!showAnswer && !loading && exercises?.length > 0) {
      inputRef.current?.focus()
    }
  }, [showAnswer, currentIndex, loading, exercises])

  // Handle Enter key for "Next Question" when answer is shown
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if answer is shown and focus is NOT in the input field
      if (e.key === 'Enter' && showAnswer && document.activeElement !== inputRef.current) {
        e.preventDefault()
        handleNext()
      }
    }

    if (showAnswer) {
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [showAnswer, currentIndex])

  const loadSession = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/sessions/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionType,
          mode: 'recall',
          wordId,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to start session')
      }

      const data = await response.json()
      setSessionId(data.sessionId)
      setExercises(data.exercises || [])
      setSessionStats({ correct: 0, incorrect: 0, total: data.exercises?.length || 0 })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const currentExercise = exercises?.[currentIndex] || null

  const handleSubmit = () => {
    if (!currentExercise) return

    const correct = userAnswer.trim().toLowerCase() === currentExercise.answer.trim().toLowerCase()
    setIsCorrect(correct)
    setShowAnswer(true)

    // Update stats immediately when answer is revealed
    setSessionStats((prev) => ({
      ...prev,
      correct: prev.correct + (correct ? 1 : 0),
      incorrect: prev.incorrect + (correct ? 0 : 1),
    }))
  }

  const handleNext = async () => {
    if (!sessionId || !currentExercise) return

    try {
      await fetch('/api/sessions/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          userWordId: currentExercise.userWordId,
          mode: 'recall',
          correct: isCorrect,
        }),
      })

      if (currentIndex < (exercises?.length ?? 0) - 1) {
        // Move to next question
        setCurrentIndex(currentIndex + 1)
        // Reset for next question
        setUserAnswer('')
        setShowAnswer(false)
        setIsCorrect(null)
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
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
            onClick={onBack}
            className="mt-4 text-red-600 hover:text-red-800 font-medium"
          >
            ← Back to mode selection
          </button>
        </div>
      </div>
    )
  }

  if (!loading && !error && (exercises?.length ?? 0) === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-6 text-center">
          <p className="text-yellow-800 mb-4">
            No words ready for recall practice. Keep revising words to move them to recall mode!
          </p>
          <button
            onClick={onBack}
            className="text-yellow-600 hover:text-yellow-800 font-medium"
          >
            ← Back to mode selection
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
          className="text-purple-600 hover:text-purple-800 mb-4 inline-flex items-center"
        >
          ← Exit session
        </button>
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Recall Mode</h1>
            <p className="text-gray-600 mt-1">
              Fill in the blanks without hints
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900">
              {currentIndex + 1} / {exercises?.length ?? 0}
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
            className="h-full bg-purple-600 transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / (exercises?.length ?? 1)) * 100}%` }}
          />
        </div>
      </div>

      {/* Exercise Card */}
      {currentExercise && (
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              {currentExercise.question}
            </h2>
            {currentExercise.context && (
              <p className="text-gray-600 italic mb-4">
                Context: {currentExercise.context}
              </p>
            )}
          </div>

          {currentExercise.exerciseType === 'fill_blank' && (
            <div>
              <input
                ref={inputRef}
                type="text"
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !showAnswer) {
                    e.preventDefault()
                    handleSubmit()
                  }
                }}
                disabled={showAnswer}
                placeholder="Type your answer..."
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500 text-lg disabled:bg-gray-100"
                autoFocus
              />
            </div>
          )}

          {currentExercise.exerciseType === 'multiple_choice' && currentExercise.options && (
            <div className="space-y-3">
              {currentExercise.options.map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setUserAnswer(option)
                    setTimeout(() => handleSubmit(), 100)
                  }}
                  disabled={showAnswer}
                  className={`w-full p-4 text-left rounded-lg border-2 transition-colors ${
                    showAnswer && option === currentExercise.answer
                      ? 'bg-green-100 border-green-500'
                      : showAnswer && option === userAnswer
                      ? 'bg-red-100 border-red-500'
                      : 'border-gray-300 hover:border-purple-400 hover:bg-purple-50'
                  } disabled:cursor-not-allowed`}
                >
                  {option}
                </button>
              ))}
            </div>
          )}

          {showAnswer && (
            <div className={`mt-6 p-4 rounded-lg ${isCorrect ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`font-semibold ${isCorrect ? 'text-green-800' : 'text-red-800'}`}>
                  {isCorrect ? '✓ Correct!' : '✗ Incorrect'}
                </span>
              </div>
              {!isCorrect && (
                <div>
                  <p className="text-gray-700">
                    <span className="font-semibold">Correct answer:</span> {currentExercise.answer}
                  </p>
                  {userAnswer && (
                    <p className="text-gray-600 mt-1">
                      <span className="font-semibold">Your answer:</span> {userAnswer}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-8">
        {!showAnswer ? (
          <button
            onClick={handleSubmit}
            disabled={!userAnswer.trim()}
            className="w-full bg-purple-600 text-white py-4 px-6 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-lg"
          >
            Submit Answer
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="w-full bg-purple-600 text-white py-4 px-6 rounded-lg hover:bg-purple-700 transition-colors font-medium text-lg"
          >
            {currentIndex < (exercises?.length ?? 0) - 1 ? 'Next Question →' : 'Finish Session'}
          </button>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-8 bg-purple-50 border border-purple-200 rounded-lg p-4">
        <h3 className="font-semibold text-purple-900 mb-2">How to use Recall Mode:</h3>
        <ul className="text-sm text-purple-800 space-y-1">
          <li>• Answer without seeing the word information first</li>
          <li>• Press Enter to submit your answer or move to the next question</li>
          <li>• Words you struggle with will move back to Revise mode</li>
          <li>• Successfully recalled words move to Practice mode</li>
        </ul>
      </div>
    </div>
  )
}
