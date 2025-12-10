# Model Selection and Connection Testing Update

## Overview

This update adds model selection and connection testing capabilities to the multi-LLM feature. Users can now:
- Select specific models for each AI provider
- Load available models dynamically from each provider's API
- Test connections to verify API keys and model configurations
- See immediate feedback on connection status

## Changes Made

### 1. Fixed Gemini API Issues ✅

**Problem**: Gemini was returning 404 errors because we were using outdated API endpoint and model names.

**Solution**:
- Changed API endpoint from `v1beta` to `v1`
- Updated model names to use `-latest` suffix:
  - `gemini-1.5-flash` → `gemini-1.5-flash-latest`
  - `gemini-1.5-pro` → `gemini-1.5-pro-latest`

**Files Modified**:
- [lib/llm/service.ts:102-115](lib/llm/service.ts#L102-L115) - Updated Gemini implementation
- [lib/llm/types.ts:54-55](lib/llm/types.ts#L54-L55) - Updated model names in provider metadata

### 2. New API Endpoints

#### `/api/llm/list-models` (POST)
Lists available models for a given provider and API key.

**Request**:
```json
{
  "provider": "google",
  "apiKey": "your-api-key"
}
```

**Response**:
```json
{
  "models": [
    "gemini-1.5-flash-latest",
    "gemini-1.5-pro-latest",
    "gemini-2.0-flash-exp"
  ]
}
```

**Features**:
- Queries provider's API to get real-time model list
- Falls back to known models if API call fails
- Filters models appropriately (e.g., only chat models for OpenAI)

#### `/api/llm/test-connection` (POST)
Tests connection to a provider with given API key and model.

**Request**:
```json
{
  "provider": "google",
  "apiKey": "your-api-key",
  "model": "gemini-1.5-flash-latest"
}
```

**Response**:
```json
{
  "success": true,
  "message": "google API is working!",
  "response": "Connection successful",
  "usage": {
    "inputTokens": 10,
    "outputTokens": 5
  }
}
```

### 3. Database Schema Updates

Added model selection columns to the `profiles` table:

```sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS anthropic_model TEXT DEFAULT 'claude-haiku-4-5-20251001',
  ADD COLUMN IF NOT EXISTS google_model TEXT DEFAULT 'gemini-1.5-flash-latest',
  ADD COLUMN IF NOT EXISTS openai_model TEXT DEFAULT 'gpt-4o-mini',
  ADD COLUMN IF NOT EXISTS deepseek_model TEXT DEFAULT 'deepseek-chat';
```

**Migration Files**:
- [supabase/migrations/002_add_model_selection.sql](supabase/migrations/002_add_model_selection.sql)
- [supabase/schema.sql:18-22](supabase/schema.sql#L18-L22) - Updated main schema

### 4. Enhanced Profile UI

The Profile page now includes:

**For Each Provider Card**:
1. **API Key Input** (existing, unchanged)
2. **Model Selector** (new)
   - Dropdown to select from available models
   - "Load Models" button to fetch models from provider API
   - Shows loading state while fetching
3. **Test Connection Button** (new)
   - Tests the API key and selected model
   - Shows success/failure feedback
   - Automatically loads models on successful test
4. **Test Results Display** (new)
   - Green box for successful tests
   - Red box for failed tests
   - Clear error messages

**State Management**:
- `selectedModels` - Currently selected model for each provider
- `availableModels` - List of available models loaded from API
- `loadingModels` - Loading state for model fetching
- `testingConnection` - Testing state for connection test
- `testResults` - Results of the last connection test

### 5. User Experience Improvements

**Workflow**:
1. User enters API key for a provider
2. User clicks "Load Models" to fetch available models
3. User selects desired model from dropdown
4. User clicks "Test Connection" to verify setup
5. Green success message confirms everything works
6. User clicks "Save Changes" to persist configuration

**Feedback**:
- Disabled buttons when API key is missing
- Loading states during async operations
- Clear success/error messages with color coding
- Automatic model loading after successful connection test

## Migration Instructions

### Step 1: Apply Database Migration

Run this SQL in your Supabase SQL Editor:

```sql
-- Add model selection columns
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS anthropic_model TEXT DEFAULT 'claude-haiku-4-5-20251001',
  ADD COLUMN IF NOT EXISTS google_model TEXT DEFAULT 'gemini-1.5-flash-latest',
  ADD COLUMN IF NOT EXISTS openai_model TEXT DEFAULT 'gpt-4o-mini',
  ADD COLUMN IF NOT EXISTS deepseek_model TEXT DEFAULT 'deepseek-chat';

-- Add comments
COMMENT ON COLUMN profiles.anthropic_model IS 'Selected Anthropic (Claude) model';
COMMENT ON COLUMN profiles.google_model IS 'Selected Google (Gemini) model';
COMMENT ON COLUMN profiles.openai_model IS 'Selected OpenAI (ChatGPT) model';
COMMENT ON COLUMN profiles.deepseek_model IS 'Selected DeepSeek model';
```

### Step 2: Verify Changes

1. Refresh your application
2. Go to Profile Settings
3. You should see:
   - Model selector for each provider
   - "Load Models" button
   - "Test Connection" button
4. Try the Gemini provider - it should now work!

## Testing Guide

### Test Scenario 1: Gemini Setup

1. Go to [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Create/copy your Gemini API key
3. In Profile, paste the key in the Google (Gemini) section
4. Click "Load Models" - should show available Gemini models
5. Select a model (e.g., `gemini-1.5-flash-latest`)
6. Click "Test Connection" - should show green success message
7. Click "Save Changes"
8. Try word lookup - should work with Gemini now!

### Test Scenario 2: Model Switching

1. Configure multiple providers with API keys
2. Test each connection
3. Switch active provider using the dropdown at top
4. Save and test word lookup
5. Verify different providers return different responses

### Test Scenario 3: Error Handling

1. Enter an invalid API key
2. Click "Test Connection"
3. Should show red error message with details
4. Fix the API key
5. Test again - should now succeed

## Files Created

1. [app/api/llm/list-models/route.ts](app/api/llm/list-models/route.ts) - List models endpoint
2. [app/api/llm/test-connection/route.ts](app/api/llm/test-connection/route.ts) - Test connection endpoint
3. [supabase/migrations/002_add_model_selection.sql](supabase/migrations/002_add_model_selection.sql) - Migration file
4. [docs/MODEL_SELECTION_UPDATE.md](docs/MODEL_SELECTION_UPDATE.md) - This documentation

## Files Modified

1. [lib/llm/service.ts](lib/llm/service.ts) - Fixed Gemini API endpoint and model names
2. [lib/llm/types.ts](lib/llm/types.ts) - Updated Gemini model names
3. [supabase/schema.sql](supabase/schema.sql) - Added model selection columns
4. [app/(app)/profile/page.tsx](app/(app)/profile/page.tsx) - Enhanced UI with model selection and testing

## Benefits

1. **Correct Gemini Integration**: Fixed 404 errors with updated API endpoint
2. **Model Flexibility**: Users can choose specific models for their needs
3. **Cost Control**: Select cheaper models (e.g., flash vs. pro)
4. **Quality Options**: Select more capable models when needed
5. **Immediate Validation**: Test API keys before saving
6. **Better UX**: Clear feedback on what's working and what's not
7. **Future-Proof**: Easy to add new models as providers release them

## Troubleshooting

### Issue: "Load Models" button doesn't work

**Cause**: API key might be invalid or provider API is down

**Solution**:
1. Verify API key is correct
2. Check provider's status page
3. Try "Test Connection" first to verify API key

### Issue: Gemini still returns 404

**Cause**: Old code might be cached or migration not applied

**Solution**:
1. Hard refresh browser (Cmd+Shift+R or Ctrl+Shift+F5)
2. Verify migration was applied in Supabase
3. Check browser console for actual error details

### Issue: Model list is empty

**Cause**: API call to list models failed, using fallback

**Solution**:
- This is OK - you can still manually type model name
- Or use the default models pre-populated
- Test connection to verify the model works

## Next Steps

Optional enhancements for the future:

1. **Model Descriptions**: Show token limits and capabilities for each model
2. **Cost Estimates**: Display approximate cost per 1M tokens
3. **Model Recommendations**: Suggest models based on use case
4. **Usage Tracking**: Track tokens used per model
5. **Auto-Selection**: Automatically pick cheapest/fastest model
6. **Model Caching**: Cache model lists to reduce API calls

## Summary

This update significantly improves the multi-LLM feature by:
- ✅ Fixing Gemini API integration
- ✅ Adding model selection capability
- ✅ Providing connection testing
- ✅ Enhancing user experience with better feedback
- ✅ Making the system more flexible and user-friendly

The Gemini provider should now work correctly, and users have full control over which models to use for each provider.
