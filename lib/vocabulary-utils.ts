import { VocabularyEntry } from '@/types/vocabulary'

/**
 * Maps database vocabulary fields (snake_case) to TypeScript types (camelCase)
 * Handles backward compatibility with 'german' field
 */
export function mapVocabularyFromDb(dbVocab: any): VocabularyEntry {
  if (!dbVocab) return dbVocab

  return {
    ...dbVocab,
    // Map target_word to targetWord for TypeScript
    targetWord: dbVocab.target_word || dbVocab.targetWord || dbVocab.german || '',
  }
}

/**
 * Maps user word data including nested vocabulary from database format
 */
export function mapUserWordFromDb(dbUserWord: any): any {
  if (!dbUserWord) return dbUserWord

  return {
    ...dbUserWord,
    vocabulary: dbUserWord.vocabulary ? mapVocabularyFromDb(dbUserWord.vocabulary) : null,
  }
}

/**
 * Helper to get the target word from a vocabulary entry
 * Supports both mapped and unmapped database fields
 */
export function getTargetWord(vocab: any): string {
  return vocab.targetWord || vocab.target_word || vocab.german || ''
}
