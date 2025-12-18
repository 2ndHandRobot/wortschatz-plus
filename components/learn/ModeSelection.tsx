'use client'

import { SessionType } from '@/types/vocabulary'

type LearningMode = 'revise' | 'recall' | 'practice'

interface ModeSelectionProps {
  onModeSelect: (mode: LearningMode, sessionType: SessionType) => void
  wordIds?: string[] | null
  isStudySelection?: boolean
}

export default function ModeSelection({ onModeSelect, wordIds, isStudySelection }: ModeSelectionProps) {
  const modes = [
    {
      id: 'revise' as LearningMode,
      title: 'Revise',
      description: 'Review words with full information shown. Test your recall by progressively hiding details.',
      color: 'bg-blue-600 hover:bg-blue-700',
      icon: '📖',
    },
    {
      id: 'recall' as LearningMode,
      title: 'Recall',
      description: 'Fill-in-the-blank exercises. Test your memory without seeing the full word first.',
      color: 'bg-purple-600 hover:bg-purple-700',
      icon: '🧠',
    },
    {
      id: 'practice' as LearningMode,
      title: 'Practice',
      description: 'Translation exercises with context. Apply your knowledge in realistic sentences.',
      color: 'bg-green-600 hover:bg-green-700',
      icon: '✍️',
    },
  ]

  const wordCount = wordIds?.length || 0

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          {isStudySelection ? 'Study Filtered Words' : 'Start Learning'}
        </h1>
        <p className="text-lg text-gray-600">
          {isStudySelection
            ? `Study ${wordCount} ${wordCount === 1 ? 'word' : 'words'} from your filtered selection`
            : 'Choose a learning mode and session type'
          }
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        {modes.map((mode) => (
          <div
            key={mode.id}
            className="bg-white rounded-lg shadow-md p-8 border-2 border-transparent hover:border-gray-300 transition-all"
          >
            <div className="text-5xl mb-4 text-center">{mode.icon}</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3 text-center">
              {mode.title}
            </h2>
            <p className="text-gray-600 mb-6 text-center min-h-[80px]">
              {mode.description}
            </p>
            <div className="space-y-3">
              <button
                onClick={() => onModeSelect(mode.id, 'complete')}
                className={`w-full ${mode.color} text-white py-3 px-4 rounded-md transition-colors font-medium`}
              >
                {isStudySelection ? `Complete Session (20 words)` : 'Complete Session'}
              </button>
              <button
                onClick={() => onModeSelect(mode.id, 'quick')}
                className="w-full bg-gray-200 text-gray-700 py-3 px-4 rounded-md hover:bg-gray-300 transition-colors font-medium"
              >
                Quick Session (5 words)
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow-md p-8">
        <h3 className="text-xl font-bold text-gray-900 mb-4">
          How the Learning System Works
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h4 className="font-semibold text-blue-600 mb-2">1. Revise</h4>
            <p className="text-sm text-gray-600">
              New words start here. You'll see the full word information and practice
              recalling hidden details. Words that you master move to Recall.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-purple-600 mb-2">2. Recall</h4>
            <p className="text-sm text-gray-600">
              Fill in missing information without seeing it first. If a word is too hard,
              it moves back to Revise. Successful words move to Practice.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-green-600 mb-2">3. Practice</h4>
            <p className="text-sm text-gray-600">
              Apply words in real contexts with translation exercises. Mastered words
              are reviewed using spaced repetition to maintain long-term memory.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
