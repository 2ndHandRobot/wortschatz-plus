/**
 * Spaced Repetition Algorithm (SM-2 inspired)
 *
 * This module implements a spaced repetition algorithm for vocabulary learning.
 * Based on the SM-2 algorithm but adapted for our three-stage learning system:
 * - Revise: Initial learning with full information
 * - Recall: Testing recall without initial presentation
 * - Practice: Application in context with spaced repetition
 */

export interface ReviewSchedule {
  nextReviewDate: string
  interval: number // days
  easeFactor: number
  repetitions: number
}

export interface PerformanceMetrics {
  correct: boolean
  attempts: number
  previousEaseFactor: number
  previousInterval: number
  previousRepetitions: number
}

/**
 * Calculate the next review schedule based on performance
 *
 * @param performance - The user's performance on this review
 * @returns Updated review schedule
 */
export function calculateNextReview(performance: PerformanceMetrics): ReviewSchedule {
  const { correct, attempts, previousEaseFactor, previousInterval, previousRepetitions } = performance

  let easeFactor = previousEaseFactor
  let interval = previousInterval
  let repetitions = previousRepetitions

  if (correct) {
    // Successful review
    repetitions += 1

    // Adjust ease factor based on how many attempts it took
    if (attempts === 1) {
      // Perfect recall on first try
      easeFactor = Math.min(2.5, easeFactor + 0.1)
    } else if (attempts === 2) {
      // Got it on second try
      easeFactor = Math.max(1.3, easeFactor - 0.05)
    } else {
      // Needed multiple attempts
      easeFactor = Math.max(1.3, easeFactor - 0.15)
    }

    // Calculate new interval using modified SM-2
    if (repetitions === 1) {
      interval = 1 // Review tomorrow
    } else if (repetitions === 2) {
      interval = 3 // Review in 3 days
    } else {
      interval = Math.round(interval * easeFactor)
    }
  } else {
    // Failed review - reset
    repetitions = 0
    interval = 1
    easeFactor = Math.max(1.3, easeFactor - 0.2)
  }

  // Calculate next review date
  const nextReviewDate = new Date()
  nextReviewDate.setDate(nextReviewDate.getDate() + interval)

  return {
    nextReviewDate: nextReviewDate.toISOString(),
    interval,
    easeFactor,
    repetitions,
  }
}

/**
 * Calculate priority score for word selection
 * Higher score = higher priority for review
 *
 * @param word - User word data
 * @returns Priority score (0-100)
 */
export function calculatePriorityScore(word: {
  status: string
  nextReviewDate?: string | null
  easeFactor: number
  repetitions: number
  incorrectCount: number
  correctCount: number
  lastPracticed?: string | null
  addedAt: string
  difficulty?: string | null
}): number {
  let score = 50 // Base score

  // 1. Status-based priority
  const statusScores = {
    revising: 80,
    recalling: 60,
    practicing: 40,
    mastered: 20,
  }
  score = statusScores[word.status as keyof typeof statusScores] || score

  // 2. Overdue reviews get massive boost
  if (word.nextReviewDate) {
    const nextReview = new Date(word.nextReviewDate)
    const now = new Date()
    const daysOverdue = Math.floor((now.getTime() - nextReview.getTime()) / (1000 * 60 * 60 * 24))

    if (daysOverdue > 0) {
      // Exponential increase for overdue items
      score += Math.min(50, daysOverdue * 10)
    } else if (daysOverdue === 0) {
      // Due today
      score += 30
    } else {
      // Not due yet - decrease priority
      score -= Math.abs(daysOverdue) * 2
    }
  }

  // 3. Difficulty adjustment (lower ease factor = harder word = higher priority)
  const difficultyBonus = (2.5 - word.easeFactor) * 10
  score += difficultyBonus

  // 4. Error rate adjustment
  const totalAttempts = word.correctCount + word.incorrectCount
  if (totalAttempts > 0) {
    const errorRate = word.incorrectCount / totalAttempts
    score += errorRate * 20
  }

  // 5. Recency bonus (newly added words get priority)
  const daysSinceAdded = Math.floor(
    (new Date().getTime() - new Date(word.addedAt).getTime()) / (1000 * 60 * 60 * 24)
  )
  if (daysSinceAdded < 7) {
    score += (7 - daysSinceAdded) * 3
  }

  // 6. Stale words (not practiced in a while)
  if (word.lastPracticed) {
    const daysSincePractice = Math.floor(
      (new Date().getTime() - new Date(word.lastPracticed).getTime()) / (1000 * 60 * 60 * 24)
    )
    if (daysSincePractice > 14) {
      score += Math.min(30, (daysSincePractice - 14) * 2)
    }
  }

  // 7. Word level bonus (lower level = higher priority)
  // +3 per level below C2: A1=+15, A2=+12, B1=+9, B2=+6, C1=+3, C2=+0
  if (word.difficulty) {
    const levelBonus = {
      'A1': 15,
      'A2': 12,
      'B1': 9,
      'B2': 6,
      'C1': 3,
      'C2': 0,
    }
    score += levelBonus[word.difficulty as keyof typeof levelBonus] || 0
  }

  // Clamp score between 0 and 100
  return Math.max(0, Math.min(100, Math.round(score)))
}

/**
 * Determine if a word should move to the next learning stage
 *
 * @param word - User word data
 * @returns New status or null if no change
 */
export function determineStatusChange(word: {
  status: string
  repetitions: number
  easeFactor: number
  correctCount: number
  incorrectCount: number
}): string | null {
  const { status, repetitions, easeFactor, correctCount, incorrectCount } = word

  const totalAttempts = correctCount + incorrectCount
  const successRate = totalAttempts > 0 ? correctCount / totalAttempts : 0

  switch (status) {
    case 'revising':
      // Move to recall after 1+ successful repetitions (user decides when ready)
      if (repetitions >= 1) {
        return 'recalling'
      }
      break

    case 'recalling':
      // Move to practice after 3+ successful repetitions
      if (repetitions >= 3 && easeFactor >= 2.0 && successRate >= 0.75) {
        return 'practicing'
      }
      // Move back to revise if struggling
      if (totalAttempts >= 5 && successRate < 0.4) {
        return 'revising'
      }
      break

    case 'practicing':
      // Move to mastered after 5+ repetitions with high success rate
      if (repetitions >= 5 && easeFactor >= 2.3 && successRate >= 0.85) {
        return 'mastered'
      }
      // Move back to recall if struggling
      if (totalAttempts >= 5 && successRate < 0.5) {
        return 'recalling'
      }
      break

    case 'mastered':
      // Move back to practice if performance drops
      if (totalAttempts >= 3 && successRate < 0.7) {
        return 'practicing'
      }
      break
  }

  return null
}

/**
 * Select words for a learning session based on mode and duration
 *
 * @param allWords - All available words
 * @param mode - Learning mode
 * @param sessionType - 'complete' or 'quick'
 * @returns Sorted array of words to practice
 */
export function selectWordsForSession<T extends {
  status: string
  nextReviewDate?: string | null
  easeFactor: number
  repetitions: number
  incorrectCount: number
  correctCount: number
  lastPracticed?: string | null
  addedAt: string
  difficulty?: string | null
}>(
  allWords: T[],
  mode: 'revise' | 'recall' | 'practice',
  sessionType: 'complete' | 'quick'
): T[] {
  // Filter words by appropriate status for the mode
  const statusMap = {
    revise: ['revising'],
    recall: ['recalling'],
    practice: ['practicing', 'mastered'],
  }

  const eligibleWords = allWords.filter(word =>
    statusMap[mode].includes(word.status)
  )

  // Calculate priority scores
  const wordsWithPriority = eligibleWords.map(word => ({
    word,
    priority: calculatePriorityScore(word),
  }))

  // Sort by priority (highest first)
  wordsWithPriority.sort((a, b) => b.priority - a.priority)

  // Select appropriate number based on session type
  const count = sessionType === 'quick' ? 5 : 20

  return wordsWithPriority.slice(0, count).map(w => w.word)
}

/**
 * Initial values for new words
 */
export const INITIAL_VALUES = {
  easeFactor: 2.5,
  interval: 0,
  repetitions: 0,
  priorityScore: 80,
  status: 'revising' as const,
}
