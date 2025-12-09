'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { SessionType } from '@/types/vocabulary'
import ModeSelection from '@/components/learn/ModeSelection'
import ReviseMode from '@/components/learn/ReviseMode'
import RecallMode from '@/components/learn/RecallMode'
import PracticeMode from '@/components/learn/PracticeMode'
import SessionSummary from '@/components/learn/SessionSummary'

type LearningMode = 'revise' | 'recall' | 'practice' | null

function LearnPageContent() {
  const searchParams = useSearchParams()
  const [selectedMode, setSelectedMode] = useState<LearningMode>(null)
  const [sessionType, setSessionType] = useState<SessionType | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [showSummary, setShowSummary] = useState(false)
  const [wordId, setWordId] = useState<string | null>(null)

  // Check URL parameters on mount
  useEffect(() => {
    const modeParam = searchParams.get('mode') as LearningMode
    const wordIdParam = searchParams.get('wordId')

    if (modeParam && ['revise', 'recall', 'practice'].includes(modeParam)) {
      setSelectedMode(modeParam)
      setSessionType('specific_word')
      setWordId(wordIdParam)
    }
  }, [searchParams])

  const handleModeSelect = (mode: LearningMode, type: SessionType) => {
    setSelectedMode(mode)
    setSessionType(type)
  }

  const handleSessionComplete = (id: string) => {
    setSessionId(id)
    setShowSummary(true)
  }

  const handleBackToModes = () => {
    setSelectedMode(null)
    setSessionType(null)
    setSessionId(null)
    setShowSummary(false)
  }

  if (showSummary && sessionId) {
    return <SessionSummary sessionId={sessionId} onBack={handleBackToModes} />
  }

  if (selectedMode && sessionType) {
    switch (selectedMode) {
      case 'revise':
        return (
          <ReviseMode
            sessionType={sessionType}
            wordId={wordId}
            onComplete={handleSessionComplete}
            onBack={handleBackToModes}
          />
        )
      case 'recall':
        return (
          <RecallMode
            sessionType={sessionType}
            wordId={wordId}
            onComplete={handleSessionComplete}
            onBack={handleBackToModes}
          />
        )
      case 'practice':
        return (
          <PracticeMode
            sessionType={sessionType}
            wordId={wordId}
            onComplete={handleSessionComplete}
            onBack={handleBackToModes}
          />
        )
    }
  }

  return <ModeSelection onModeSelect={handleModeSelect} />
}

export default function LearnPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <LearnPageContent />
    </Suspense>
  )
}
