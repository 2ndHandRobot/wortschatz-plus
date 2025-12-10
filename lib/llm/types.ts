// LLM Provider Types and Interfaces

export type LLMProvider = 'anthropic' | 'google' | 'openai' | 'deepseek';

export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  model?: string; // Optional: specific model to use, falls back to defaults if not provided
}

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface LLMResponse {
  content: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface LLMProviderInfo {
  id: LLMProvider;
  name: string;
  description: string;
  apiKeyPlaceholder: string;
  apiKeyUrl: string;
  models: {
    fast: string;
    standard: string;
  };
}

export const LLM_PROVIDERS: Record<LLMProvider, LLMProviderInfo> = {
  anthropic: {
    id: 'anthropic',
    name: 'Claude (Anthropic)',
    description: 'Advanced AI assistant with strong reasoning capabilities',
    apiKeyPlaceholder: 'sk-ant-...',
    apiKeyUrl: 'https://console.anthropic.com',
    models: {
      fast: 'claude-haiku-4-5-20251001',
      standard: 'claude-sonnet-4-5-20250929',
    },
  },
  google: {
    id: 'google',
    name: 'Gemini (Google)',
    description: 'Google\'s multimodal AI model',
    apiKeyPlaceholder: 'AIza...',
    apiKeyUrl: 'https://aistudio.google.com/app/apikey',
    models: {
      fast: 'gemini-2.5-flash-latest',
      standard: 'gemini-2.5-pro-latest',
    },
  },
  openai: {
    id: 'openai',
    name: 'ChatGPT (OpenAI)',
    description: 'Popular conversational AI from OpenAI',
    apiKeyPlaceholder: 'sk-...',
    apiKeyUrl: 'https://platform.openai.com/api-keys',
    models: {
      fast: 'gpt-4o-mini',
      standard: 'gpt-4o',
    },
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    description: 'Cost-effective AI model with strong performance',
    apiKeyPlaceholder: 'sk-...',
    apiKeyUrl: 'https://platform.deepseek.com/api_keys',
    models: {
      fast: 'deepseek-chat',
      standard: 'deepseek-chat',
    },
  },
};
