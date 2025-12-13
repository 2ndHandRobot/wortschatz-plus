# Multi-Language Fixes - Making the App Truly Language-Agnostic

## Issues Fixed

### 1. Static UI Copy
**Problem**: The home page always said "Enter a German word or phrase" regardless of selected language.

**Solution**: Made all UI copy dynamic based on user's `target_language`:
- [app/(app)/page.tsx](app/(app)/page.tsx)
  - Added `LANGUAGE_NAMES` mapping (German → "German", French → "French", etc.)
  - Added `LANGUAGE_EXAMPLES` with language-specific placeholder examples
  - Fetches user's target language on component mount
  - Updates all text dynamically: "Look up {Language} words", "Enter a {Language} word"

### 2. Language-Specific LLM Prompts
**Problem**: LLM prompts were hardcoded for German, so French words would get German translations.

**Solution**: Made LLM prompts dynamic based on target language:
- [app/api/lookup/route.ts](app/api/lookup/route.ts)
  - Fetches user's `target_language` before making LLM calls
  - Creates dynamic language name (e.g., "French" for french)
  - Updated both prompts:
    - Root form extraction: "You are a {Language} language expert..."
    - Vocabulary generation: Adapted for language-specific features
  - Examples in JSON schema now language-aware

### 3. Database Column Name
**Problem**: Column was named `german` which was confusing for non-German languages.

**Solution**: Renamed column to `target_word`:
- Database migration: [004_rename_german_to_target_word.sql](supabase/migrations/004_rename_german_to_target_word.sql)
- Updated schema: [schema.sql](supabase/schema.sql)
- Updated TypeScript types: [types/vocabulary.ts](types/vocabulary.ts)
  - Added `targetWord` field
  - Kept `german?` for backward compatibility
- Updated all API routes to use `target_word`
- Updated all frontend components with `getTargetWord()` helper function

## Files Modified

### Database
- `supabase/schema.sql` - Updated column name and indexes
- `supabase/migrations/004_rename_german_to_target_word.sql` - Migration file
- `APPLY_COLUMN_RENAME_MIGRATION.sql` - Quick apply script

### TypeScript Types
- `types/vocabulary.ts`
  - `BaseVocabularyEntry.targetWord` (new field)
  - `BaseVocabularyEntry.german?` (legacy support)
  - `Example.targetWord?` (new field)
  - `Example.german?` (legacy support)

### API Routes
- `app/api/lookup/route.ts` - Dynamic LLM prompts, use `target_word` column
- `app/api/words/add/route.ts` - Insert with `target_word` field
- All queries now use `target_word` instead of `german`

### Frontend Components
- `app/(app)/page.tsx` - Dynamic UI copy, fetch user language
- `app/(app)/dictionary/page.tsx` - Added `getTargetWord()` helper, updated all references
- All display logic now uses `targetWord` field with `german` fallback

## How to Apply

### Step 1: Apply Database Migration
```sql
-- Run this in Supabase SQL Editor
-- File: APPLY_COLUMN_RENAME_MIGRATION.sql

ALTER TABLE vocabulary
RENAME COLUMN german TO target_word;

COMMENT ON COLUMN vocabulary.target_word IS 'The word in the target language being learned';

DROP INDEX IF EXISTS idx_vocabulary_german;
DROP INDEX IF EXISTS idx_vocabulary_language_german;

CREATE INDEX idx_vocabulary_target_word ON vocabulary(target_word);
CREATE INDEX idx_vocabulary_language_target_word ON vocabulary(language, target_word);
```

### Step 2: Verify Changes
All code changes are already in place. Just test:

1. **Change language in Profile** → French
2. **Go to home page** → Should say "Enter a French word"
3. **Look up a French word** → e.g., "aller"
4. **Verify LLM response** → Should be French word definition, not German
5. **Check dictionary** → Word should display correctly

## Backward Compatibility

The code maintains backward compatibility:
- TypeScript types include both `targetWord` and `german?`
- Frontend components use: `targetWord || german`
- API routes support both field names during transition
- Existing data works seamlessly after column rename

## Testing Checklist

- [ ] Profile page: Select French → Save
- [ ] Home page: UI says "Enter a French word"
- [ ] Look up "aller" (French word meaning "to go")
- [ ] Verify LLM returns French definition
- [ ] Add word to dictionary
- [ ] Dictionary shows word correctly
- [ ] Word card displays properly
- [ ] Edit word form works
- [ ] Search in dictionary works
- [ ] Alphabetical grouping works

## Language-Specific Features

The LLM prompts now adapt per language:
- **Articles**: "der/die/das" for German, "le/la" for French
- **Auxiliaries**: "haben/sein" for German, "avoir/être" for French
- **Separable verbs**: Only for languages that have them (German, Dutch)
- **Cases**: Grammatical cases only for applicable languages

## Next Steps (Optional)

1. **Update search placeholder** in dictionary to be language-specific
2. **Language-specific sorting** (e.g., Spanish handles ñ differently)
3. **Pronunciation guides** specific to each language
4. **Gender colors** (for Romance languages with 2 genders vs German with 3)

## Migration Safety

- ✅ Column rename is instant (just metadata change in PostgreSQL)
- ✅ Indexes recreated automatically
- ✅ No data loss or downtime
- ✅ Backward compatible code
- ✅ Can rollback by renaming column back

## Summary

The app is now truly multi-language:
- ✅ UI adapts to selected language
- ✅ LLM prompts use correct language
- ✅ Database schema is language-agnostic
- ✅ All code uses generic field names
- ✅ Fully backward compatible
