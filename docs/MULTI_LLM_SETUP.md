# Multi-LLM Provider Support

Wortschatz Plus now supports multiple AI providers for enhanced flexibility and functionality. You can configure and switch between different LLM providers based on your preferences and needs.

## Supported Providers

### 1. Claude (Anthropic)
- **Description**: Advanced AI assistant with strong reasoning capabilities
- **Models**:
  - Fast: `claude-haiku-4-5-20251001`
  - Standard: `claude-sonnet-4-5-20250929`
- **Get API Key**: [console.anthropic.com](https://console.anthropic.com)
- **Pricing**: Usage-based (see Anthropic pricing)

### 2. Gemini (Google)
- **Description**: Google's multimodal AI model
- **Models**:
  - Fast: `gemini-1.5-flash`
  - Standard: `gemini-1.5-pro`
- **Get API Key**: [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
- **Pricing**: Free tier available, then usage-based

### 3. ChatGPT (OpenAI)
- **Description**: Popular conversational AI from OpenAI
- **Models**:
  - Fast: `gpt-4o-mini`
  - Standard: `gpt-4o`
- **Get API Key**: [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- **Pricing**: Usage-based (see OpenAI pricing)

### 4. DeepSeek
- **Description**: Cost-effective AI model with strong performance
- **Models**: `deepseek-chat`
- **Get API Key**: [platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys)
- **Pricing**: Very cost-effective usage-based pricing

## Setup Instructions

### 1. Configure Your Profile

1. Navigate to your **Profile Settings** page
2. Scroll to the **AI Assistant Configuration** section
3. Select your preferred **Active AI Provider** from the dropdown
4. Configure the API key(s) for the provider(s) you want to use

### 2. Add API Keys

For each provider you want to use:

1. Click on the API key input field for that provider
2. Paste your API key (obtain from the provider's website linked above)
3. The active provider will be highlighted with a blue border
4. Click **Save Changes** to save your configuration

**Important Notes:**
- You only need to configure the API key for your selected provider
- However, you can configure multiple providers to easily switch between them
- API keys are stored securely in the database with row-level security
- Your API keys are never shared with third parties (only sent to the AI provider you selected)

### 3. Test Your Configuration

After saving your API key, you can test the connection:

1. Use the word lookup feature
2. Generate practice exercises
3. The system will use your selected AI provider automatically

## Features Using AI

The following features utilize your configured AI provider:

1. **Word Lookup**: Identifies root forms and provides grammatical information
2. **Practice Exercise Generation**: Creates context-appropriate sentences for translation
3. **Translation Evaluation**: Provides feedback on your German translations
4. **Vocabulary Enrichment**: Adds examples and usage notes to vocabulary entries

## Switching Providers

To switch to a different AI provider:

1. Go to **Profile Settings**
2. Change the **Active AI Provider** dropdown
3. Ensure you have an API key configured for the new provider
4. Click **Save Changes**
5. All AI features will now use the new provider

## Database Schema Changes

### Migration Applied

The following database migration adds multi-LLM support:

```sql
-- Add new columns to profiles table for selected LLM provider
ALTER TABLE profiles
  ADD COLUMN selected_llm_provider TEXT DEFAULT 'anthropic'
  CHECK (selected_llm_provider IN ('anthropic', 'google', 'openai', 'deepseek'));

-- Rename claude_api_key to anthropic_api_key for consistency
ALTER TABLE profiles
  RENAME COLUMN claude_api_key TO anthropic_api_key;

-- Add API key columns for other providers
ALTER TABLE profiles
  ADD COLUMN google_api_key TEXT,
  ADD COLUMN openai_api_key TEXT,
  ADD COLUMN deepseek_api_key TEXT;
```

### To Apply Migration

If you're setting up a new database, the migration file is located at:
```
supabase/migrations/001_add_multi_llm_support.sql
```

For existing databases, apply the migration using:
```bash
# Using Supabase CLI
supabase db push

# Or run the migration file directly in your Supabase SQL editor
```

## Implementation Details

### LLM Service Architecture

The application uses a unified `LLMService` class that abstracts different providers:

**Location**: `lib/llm/service.ts`

**Key Features**:
- Unified interface for all providers
- Automatic provider selection based on user profile
- Error handling and fallback support
- Token usage tracking

**Example Usage**:
```typescript
import { getUserLLMConfig, LLMService } from '@/lib/llm/service';

// In an API route
const llmConfig = await getUserLLMConfig(supabase, user.id);
const llmService = new LLMService(llmConfig);

const response = await llmService.generateCompletion(
  [{ role: 'user', content: 'Your prompt here' }],
  { maxTokens: 1024, model: 'fast' }
);
```

### Updated API Routes

All LLM-dependent routes have been updated:
- `/api/lookup` - Word lookup
- `/api/practice/generate` - Practice exercise generation
- `/api/practice/evaluate` - Translation evaluation
- `/api/vocabulary/enrich` - Vocabulary enrichment
- `/api/test-claude` - API connection test
- `/api/sessions/start` - Learning session initialization

## Security Considerations

### API Key Storage

- API keys are stored in the `profiles` table
- Protected by Supabase Row-Level Security (RLS)
- Users can only access their own API keys
- **Production Recommendation**: Encrypt API keys before storage

### Best Practices

1. **Never share your API keys** with anyone
2. **Rotate keys regularly** for security
3. **Monitor usage** through your provider's dashboard
4. **Set up billing alerts** to avoid unexpected charges
5. **Use environment-specific keys** (dev vs. production)

## Troubleshooting

### API Key Not Working

1. Verify the API key is correct (check for extra spaces)
2. Ensure the key has the necessary permissions
3. Check your provider's dashboard for usage limits
4. Use the test endpoint to verify connectivity

### Switching Providers

If you encounter issues after switching providers:
1. Clear your browser cache
2. Log out and log back in
3. Verify the new provider's API key is valid
4. Check the browser console for error messages

### Rate Limiting

Different providers have different rate limits:
- **Anthropic**: Varies by tier
- **Google**: Generous free tier, then tiered limits
- **OpenAI**: Varies by account type
- **DeepSeek**: Check their documentation

If you hit rate limits, consider:
1. Switching to a different provider temporarily
2. Implementing delays between requests
3. Upgrading your provider plan

## Cost Comparison

Approximate costs per 1M tokens (as of 2025):

| Provider | Input (Fast) | Output (Fast) | Input (Standard) | Output (Standard) |
|----------|--------------|---------------|------------------|-------------------|
| Anthropic (Claude) | ~$0.80 | ~$4.00 | ~$3.00 | ~$15.00 |
| Google (Gemini) | ~$0.075 | ~$0.30 | ~$1.25 | ~$5.00 |
| OpenAI (ChatGPT) | ~$0.15 | ~$0.60 | ~$2.50 | ~$10.00 |
| DeepSeek | ~$0.14 | ~$0.28 | ~$0.14 | ~$0.28 |

**Note**: Prices are approximate and subject to change. Check provider websites for current pricing.

## Future Enhancements

Potential improvements for the multi-LLM feature:

1. **Provider-Specific Optimizations**: Tailor prompts for each provider's strengths
2. **Fallback Logic**: Automatically switch providers if one fails
3. **Cost Tracking**: Monitor and display per-provider usage costs
4. **A/B Testing**: Compare quality across providers
5. **Local LLM Support**: Add support for locally-hosted models
6. **Provider Performance Metrics**: Track response time and quality

## Support

For issues or questions:
1. Check the application logs in your browser console
2. Review provider-specific documentation
3. Open an issue in the project repository
4. Contact the development team

## Version History

- **v1.0** (2025-01): Initial multi-LLM support release
  - Added support for 4 providers
  - Unified LLM service architecture
  - Updated all API routes
  - Enhanced profile UI
