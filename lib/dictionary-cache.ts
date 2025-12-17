import { UserWord, WordTag } from '@/types/vocabulary'
import { openDB, DBSchema, IDBPDatabase } from 'idb'
import { getTargetWord } from './vocabulary-utils'

interface DictionaryCacheDB extends DBSchema {
  dictionary: {
    key: string
    value: {
      words: UserWord[]
      wordTags: Record<string, WordTag[]>
      timestamp: number
      language: string
    }
  }
}

interface CacheEntry {
  words: UserWord[]
  wordTags: Map<string, WordTag[]>
  timestamp: number
}

class DictionaryCache {
  private static instance: DictionaryCache
  private cache: Map<string, CacheEntry> = new Map()
  private db: IDBPDatabase<DictionaryCacheDB> | null = null
  private dbInitPromise: Promise<void> | null = null

  private constructor() {
    this.initDB()
  }

  static getInstance(): DictionaryCache {
    if (!DictionaryCache.instance) {
      DictionaryCache.instance = new DictionaryCache()
    }
    return DictionaryCache.instance
  }

  private async initDB(): Promise<void> {
    if (this.dbInitPromise) {
      return this.dbInitPromise
    }

    this.dbInitPromise = (async () => {
      try {
        this.db = await openDB<DictionaryCacheDB>('dictionary-cache', 1, {
          upgrade(db) {
            if (!db.objectStoreNames.contains('dictionary')) {
              db.createObjectStore('dictionary', { keyPath: 'language' })
            }
          },
        })
        console.log('📦 IndexedDB initialized for dictionary cache')
      } catch (error) {
        console.error('Failed to initialize IndexedDB:', error)
        this.db = null
      }
    })()

    return this.dbInitPromise
  }

  private getCacheKey(language: string): string {
    return `dict_${language}`
  }

  async get(language: string): Promise<CacheEntry | null> {
    const cacheKey = this.getCacheKey(language)

    // First, check in-memory cache
    const memoryCache = this.cache.get(cacheKey)
    if (memoryCache) {
      console.log('⚡ Dictionary loaded from memory cache')
      return memoryCache
    }

    // Then check IndexedDB
    await this.dbInitPromise
    if (this.db) {
      try {
        const dbEntry = await this.db.get('dictionary', language)
        if (dbEntry) {
          console.log('💾 Dictionary loaded from IndexedDB cache')

          // Convert tags object back to Map
          const tagsMap = new Map<string, WordTag[]>(
            Object.entries(dbEntry.wordTags)
          )

          const cacheEntry: CacheEntry = {
            words: dbEntry.words,
            wordTags: tagsMap,
            timestamp: dbEntry.timestamp,
          }

          // Store in memory for faster access next time
          this.cache.set(cacheKey, cacheEntry)

          return cacheEntry
        }
      } catch (error) {
        console.error('Failed to read from IndexedDB:', error)
      }
    }

    return null
  }

  async set(
    language: string,
    words: UserWord[],
    wordTags: Map<string, WordTag[]>
  ): Promise<void> {
    const cacheKey = this.getCacheKey(language)
    const timestamp = Date.now()

    const cacheEntry: CacheEntry = {
      words,
      wordTags,
      timestamp,
    }

    // Store in memory
    this.cache.set(cacheKey, cacheEntry)
    console.log('⚡ Dictionary cached in memory')

    // Store in IndexedDB for persistence
    await this.dbInitPromise
    if (this.db) {
      try {
        // Convert Map to object for IndexedDB storage
        const tagsObject: Record<string, WordTag[]> = {}
        wordTags.forEach((value, key) => {
          tagsObject[key] = value
        })

        await this.db.put('dictionary', {
          language,
          words,
          wordTags: tagsObject,
          timestamp,
        })
        console.log('💾 Dictionary cached in IndexedDB')
      } catch (error) {
        console.error('Failed to write to IndexedDB:', error)
      }
    }
  }

  async updateWord(language: string, updatedWord: UserWord): Promise<void> {
    const cacheKey = this.getCacheKey(language)
    const cached = this.cache.get(cacheKey)

    if (!cached) {
      console.log('⚠️ No cache to update, skipping partial update')
      return
    }

    // Update word in memory cache
    const wordIndex = cached.words.findIndex(w => w.id === updatedWord.id)
    if (wordIndex !== -1) {
      cached.words[wordIndex] = updatedWord
      console.log('✏️ Word updated in memory cache')
    } else {
      // Word doesn't exist, add it (sorted)
      cached.words.push(updatedWord)
      cached.words.sort((a, b) => {
        const wordA = a.vocabulary ? getTargetWord(a.vocabulary).toLowerCase() : ''
        const wordB = b.vocabulary ? getTargetWord(b.vocabulary).toLowerCase() : ''
        return wordA.localeCompare(wordB, 'de')
      })
      console.log('➕ Word added to memory cache')
    }

    // Update timestamp
    cached.timestamp = Date.now()

    // Sync to IndexedDB
    await this.syncToIndexedDB(language, cached)
  }

  async removeWord(language: string, wordId: string): Promise<void> {
    const cacheKey = this.getCacheKey(language)
    const cached = this.cache.get(cacheKey)

    if (!cached) {
      console.log('⚠️ No cache to update, skipping partial removal')
      return
    }

    // Remove word from memory cache
    cached.words = cached.words.filter(w => w.id !== wordId)

    // Remove word tags
    cached.wordTags.delete(wordId)

    // Update timestamp
    cached.timestamp = Date.now()

    console.log('🗑️ Word removed from memory cache')

    // Sync to IndexedDB
    await this.syncToIndexedDB(language, cached)
  }

  async updateWordTags(language: string, wordId: string, tags: WordTag[]): Promise<void> {
    const cacheKey = this.getCacheKey(language)
    const cached = this.cache.get(cacheKey)

    if (!cached) {
      console.log('⚠️ No cache to update, skipping partial tag update')
      return
    }

    // Update tags in memory cache
    if (tags.length > 0) {
      cached.wordTags.set(wordId, tags)
    } else {
      cached.wordTags.delete(wordId)
    }

    // Update timestamp
    cached.timestamp = Date.now()

    console.log('🏷️ Word tags updated in memory cache')

    // Sync to IndexedDB
    await this.syncToIndexedDB(language, cached)
  }

  private async syncToIndexedDB(language: string, cached: CacheEntry): Promise<void> {
    await this.dbInitPromise
    if (this.db) {
      try {
        // Convert Map to object for IndexedDB storage
        const tagsObject: Record<string, WordTag[]> = {}
        cached.wordTags.forEach((value, key) => {
          tagsObject[key] = value
        })

        await this.db.put('dictionary', {
          language,
          words: cached.words,
          wordTags: tagsObject,
          timestamp: cached.timestamp,
        })
        console.log('💾 Cache synced to IndexedDB')
      } catch (error) {
        console.error('Failed to sync to IndexedDB:', error)
      }
    }
  }

  invalidate(language: string): void {
    const cacheKey = this.getCacheKey(language)

    // Clear memory cache
    this.cache.delete(cacheKey)
    console.log('🗑️ Memory cache invalidated')

    // Clear IndexedDB cache
    if (this.db) {
      this.db.delete('dictionary', language).catch((error) => {
        console.error('Failed to delete from IndexedDB:', error)
      })
      console.log('🗑️ IndexedDB cache invalidated')
    }
  }

  invalidateAll(): void {
    // Clear all memory cache
    this.cache.clear()
    console.log('🗑️ All memory cache cleared')

    // Clear all IndexedDB cache
    if (this.db) {
      this.db.clear('dictionary').catch((error) => {
        console.error('Failed to clear IndexedDB:', error)
      })
      console.log('🗑️ All IndexedDB cache cleared')
    }
  }

  getCacheAge(language: string): number | null {
    const cacheKey = this.getCacheKey(language)
    const cached = this.cache.get(cacheKey)
    if (cached) {
      return Date.now() - cached.timestamp
    }
    return null
  }

  isValid(language: string, maxAge: number = Infinity): boolean {
    const age = this.getCacheAge(language)
    return age !== null && age < maxAge
  }
}

export const dictionaryCache = DictionaryCache.getInstance()
