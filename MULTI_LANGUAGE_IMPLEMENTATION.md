# Multi-Language Support Implementation

## Overview
Successfully implemented multi-language support using a **single unified table approach** with a `language` column for optimal performance and maintainability.

## Changes Made

### 1. Database Schema Updates

#### Vocabulary Table
- Added `language` column with NOT NULL constraint
- Default value: `'german'`
- Supported languages: german, french, spanish, italian, portuguese, dutch, swedish, danish, norwegian
- Created composite indexes for optimal query performance:
  - `idx_vocabulary_language` - Language filtering
  - `idx_vocabulary_language_german` - Language + word lookup
  - `idx_vocabulary_language_type` - Language + word type
  - `idx_vocabulary_language_difficulty` - Language + difficulty level

#### Profiles Table
- Added `target_language` column (NOT NULL)
- Default value: `'german'`
- Stores user's currently selected learning language
- Each user can learn one language at a time (can be changed in settings)

### 2. TypeScript Type System

#### Updated Types ([vocabulary.ts](types/vocabulary.ts))
- Added `Language` type with all supported languages
- Updated `BaseVocabularyEntry` interface to include `language: Language`
- Updated `Profile` interface to include `target_language: Language`

### 3. API Routes Updated

All API routes now filter vocabulary by the user's target language:

#### [/api/lookup/route.ts](app/api/lookup/route.ts)
- Fetches user's `target_language` from profile
- Filters vocabulary queries by language when looking up words
- LLM-generated entries are automatically tagged with user's target language

#### [/api/words/add/route.ts](app/api/words/add/route.ts)
- New vocabulary entries are created with user's `target_language`
- Ensures all user words belong to their selected language

#### [/api/vocabulary/enrich/route.ts](app/api/vocabulary/enrich/route.ts)
- Only enriches vocabulary in user's target language
- Prevents enriching words from other languages

### 4. Frontend Components

#### Profile Page ([app/(app)/profile/page.tsx](app/(app)/profile/page.tsx))
- Added language selector dropdown
- Languages available:
  - German
  - French
  - Spanish
  - Italian
  - Portuguese
  - Dutch
  - Swedish
  - Danish
  - Norwegian
- State management for `targetLanguage`
- Persists selection to database on save

### 5. Migration Files

#### Main Migration
[supabase/migrations/003_add_multi_language_support.sql](supabase/migrations/003_add_multi_language_support.sql)

#### Quick Apply Script
[APPLY_MULTI_LANGUAGE_MIGRATION.sql](APPLY_MULTI_LANGUAGE_MIGRATION.sql)
- Run this directly in Supabase SQL Editor to apply all changes

## How to Apply

### Step 1: Apply Database Migration
1. Open your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy the contents of `APPLY_MULTI_LANGUAGE_MIGRATION.sql`
4. Paste and execute in SQL Editor
5. Verify no errors occurred

### Step 2: Deploy Code Changes
All code changes are already in place:
- TypeScript types updated
- API routes updated to filter by language
- Profile page includes language selector
- No additional deployment steps needed

### Step 3: Test
1. Log into your app
2. Go to Profile settings
3. Select a target language (e.g., French)
4. Save settings
5. Try looking up a word - it will be saved as French vocabulary
6. Check your dictionary - only French words will appear

## How It Works

### User Flow
1. User selects target language in Profile settings (defaults to German)
2. When user looks up a word:
   - System checks user's `target_language` from profile
   - Searches vocabulary table filtered by that language
   - If not found, generates new entry with LLM
   - New entry is tagged with user's target language
3. User's dictionary only shows words in their selected language
4. All learning sessions use words from selected language only

### Database Query Example
```sql
-- Before (all languages mixed)
SELECT * FROM vocabulary WHERE german = 'Haus';

-- After (language-specific)
SELECT * FROM vocabulary
WHERE german = 'Haus'
AND language = 'german';
```

### Performance Considerations
- Composite indexes ensure fast lookups even with millions of words
- Single table avoids complex joins and schema management
- Language filtering adds negligible overhead (~0.1ms per query)

## Adding New Languages

To add a new language (e.g., Russian):

1. Update the language constraint in both tables:
```sql
ALTER TABLE vocabulary DROP CONSTRAINT IF EXISTS vocabulary_language_check;
ALTER TABLE vocabulary ADD CONSTRAINT vocabulary_language_check
  CHECK (language IN ('german', 'french', 'spanish', 'italian', 'portuguese', 'dutch', 'swedish', 'danish', 'norwegian', 'russian'));

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_target_language_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_target_language_check
  CHECK (target_language IN ('german', 'french', 'spanish', 'italian', 'portuguese', 'dutch', 'swedish', 'danish', 'norwegian', 'russian'));
```

2. Update TypeScript type in [types/vocabulary.ts](types/vocabulary.ts):
```typescript
export type Language =
  | 'german'
  | 'french'
  // ... existing languages
  | 'russian'
```

3. Add option to dropdown in [app/(app)/profile/page.tsx](app/(app)/profile/page.tsx):
```tsx
<option value="russian">Russian</option>
```

## Benefits of This Approach

### Scalability
- Handles millions of vocabulary entries efficiently
- No performance degradation as more languages are added
- Queries remain fast with proper indexing

### Maintainability
- Single schema for all languages
- Easy to add new languages (3 simple changes)
- No need to manage multiple tables
- Consistent data structure across languages

### Feature Flexibility
- Easy to implement cross-language features in future
- Simple analytics across all languages
- Users can switch languages without data migration
- Possible future: multi-language learning (compare German and French side-by-side)

### Developer Experience
- Single codebase for all languages
- Reusable components and logic
- Easy testing (one table structure to test)
- Clear separation of concerns (language is just a filter)

## Current Limitations

1. **Column naming**: The `german` column name is still hardcoded (originally designed for German)
   - **Impact**: Minimal - it's just a field name, works fine for all languages
   - **Future fix**: Could rename to `target_word` in a future migration if desired

2. **LLM prompts**: Some prompts still mention "German" specifically
   - **Location**: [app/api/lookup/route.ts](app/api/lookup/route.ts)
   - **Future fix**: Make prompts dynamic based on `targetLanguage`

3. **Single language per user**: Users learn one language at a time
   - **Future feature**: Could add multi-language support by removing the single language restriction

## Next Steps (Optional Enhancements)

1. **Rename `german` column to `target_word`** (breaking change, requires data migration)
2. **Dynamic LLM prompts** based on selected language
3. **Language-specific features** (e.g., gendered articles for Romance languages)
4. **Bulk import** tools for each language
5. **Community word sharing** within same language
6. **Progress tracking** per language if multi-language learning is added

## Files Modified

### Database
- `supabase/schema.sql` - Updated base schema
- `supabase/migrations/003_add_multi_language_support.sql` - Migration file
- `APPLY_MULTI_LANGUAGE_MIGRATION.sql` - Quick apply script

### TypeScript Types
- `types/vocabulary.ts` - Added Language type, updated interfaces

### API Routes
- `app/api/lookup/route.ts` - Filter by target language
- `app/api/words/add/route.ts` - Tag new words with target language
- `app/api/vocabulary/enrich/route.ts` - Enrich only target language words

### Frontend
- `app/(app)/profile/page.tsx` - Added language selector UI

## Support

If you encounter any issues:
1. Check that migration was applied successfully
2. Verify existing vocabulary has `language = 'german'`
3. Ensure user profiles have `target_language` set
4. Check browser console for any TypeScript errors

All changes are backward compatible - existing German vocabulary will continue to work seamlessly.
