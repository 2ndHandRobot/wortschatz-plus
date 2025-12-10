// LLM Service - Unified interface for multiple LLM providers

import Anthropic from '@anthropic-ai/sdk';
import { LLMConfig, LLMMessage, LLMResponse } from './types';

/**
 * Unified LLM service that works with multiple providers
 */
export class LLMService {
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  /**
   * Generate a completion using the configured LLM provider
   */
  async generateCompletion(
    messages: LLMMessage[],
    options: {
      maxTokens?: number;
      temperature?: number;
      model?: 'fast' | 'standard';
    } = {}
  ): Promise<LLMResponse> {
    const { maxTokens = 1024, temperature = 1.0, model = 'fast' } = options;

    switch (this.config.provider) {
      case 'anthropic':
        return this.anthropicCompletion(messages, maxTokens, temperature, model);
      case 'google':
        return this.googleCompletion(messages, maxTokens, temperature, model);
      case 'openai':
        return this.openaiCompletion(messages, maxTokens, temperature, model);
      case 'deepseek':
        return this.deepseekCompletion(messages, maxTokens, temperature, model);
      default:
        throw new Error(`Unsupported LLM provider: ${this.config.provider}`);
    }
  }

  /**
   * Anthropic (Claude) implementation
   */
  private async anthropicCompletion(
    messages: LLMMessage[],
    maxTokens: number,
    temperature: number,
    modelType: 'fast' | 'standard'
  ): Promise<LLMResponse> {
    const anthropic = new Anthropic({
      apiKey: this.config.apiKey.trim(),
    });

    // Use configured model if available, otherwise fall back to defaults
    const model = this.config.model ||
      (modelType === 'fast'
        ? 'claude-haiku-4-5-20251001'
        : 'claude-sonnet-4-5-20250929');

    // Separate system messages from user/assistant messages
    const systemMessage = messages.find((m) => m.role === 'system')?.content;
    const conversationMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    const response = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      temperature,
      system: systemMessage,
      messages: conversationMessages,
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Anthropic');
    }

    return {
      content: content.text,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }

  /**
   * Google (Gemini) implementation
   */
  private async googleCompletion(
    messages: LLMMessage[],
    maxTokens: number,
    temperature: number,
    modelType: 'fast' | 'standard'
  ): Promise<LLMResponse> {
    // Use configured model if available, otherwise fall back to defaults
    const model = this.config.model ||
      (modelType === 'fast' ? 'gemini-2.5-flash-latest' : 'gemini-2.5-pro-latest');

    console.log('=== Gemini API Call Debug ===');
    console.log('Config model:', this.config.model);
    console.log('Model type:', modelType);
    console.log('Final model being used:', model);
    console.log('Full config:', { provider: this.config.provider, hasApiKey: !!this.config.apiKey, configuredModel: this.config.model });

    // Format messages for Gemini API
    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const systemInstruction = messages.find((m) => m.role === 'system')?.content;

    const apiUrl = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${this.config.apiKey.trim()}`;
    console.log('API URL:', apiUrl.replace(/key=[^&]+/, 'key=***'));

    const response = await fetch(apiUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents,
          systemInstruction: systemInstruction
            ? { parts: [{ text: systemInstruction }] }
            : undefined,
          generationConfig: {
            maxOutputTokens: maxTokens,
            temperature,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google API error: ${error}`);
    }

    const data = await response.json();

    console.log('=== Gemini Raw Response ===');
    console.log('Full response data:', JSON.stringify(data, null, 2));

    if (!data.candidates || data.candidates.length === 0) {
      throw new Error('No response from Google API');
    }

    const content = data.candidates[0].content.parts[0].text;

    console.log('=== Gemini Content Extraction ===');
    console.log('Extracted content (raw):', content);
    console.log('Content length:', content.length);
    const charCodes = content.slice(0, 100).split('').map((c: string) => `${c}(${c.charCodeAt(0)})`).join(' ');
    console.log('Content as char codes:', charCodes);
    console.log('Test umlaut search - contains ö:', content.includes('ö'));
    console.log('Test umlaut search - contains ä:', content.includes('ä'));
    console.log('Test umlaut search - contains ü:', content.includes('ü'));

    return {
      content,
      usage: data.usageMetadata
        ? {
            inputTokens: data.usageMetadata.promptTokenCount || 0,
            outputTokens: data.usageMetadata.candidatesTokenCount || 0,
          }
        : undefined,
    };
  }

  /**
   * OpenAI (ChatGPT) implementation
   */
  private async openaiCompletion(
    messages: LLMMessage[],
    maxTokens: number,
    temperature: number,
    modelType: 'fast' | 'standard'
  ): Promise<LLMResponse> {
    // Use configured model if available, otherwise fall back to defaults
    const model = this.config.model ||
      (modelType === 'fast' ? 'gpt-4o-mini' : 'gpt-4o');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey.trim()}`,
      },
      body: JSON.stringify({
        model,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        max_tokens: maxTokens,
        temperature,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json();

    if (!data.choices || data.choices.length === 0) {
      throw new Error('No response from OpenAI API');
    }

    return {
      content: data.choices[0].message.content,
      usage: data.usage
        ? {
            inputTokens: data.usage.prompt_tokens,
            outputTokens: data.usage.completion_tokens,
          }
        : undefined,
    };
  }

  /**
   * DeepSeek implementation
   */
  private async deepseekCompletion(
    messages: LLMMessage[],
    maxTokens: number,
    temperature: number,
    _modelType: 'fast' | 'standard'
  ): Promise<LLMResponse> {
    // Use configured model if available, otherwise fall back to default
    const model = this.config.model || 'deepseek-chat';

    // DeepSeek uses OpenAI-compatible API
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey.trim()}`,
      },
      body: JSON.stringify({
        model,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        max_tokens: maxTokens,
        temperature,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DeepSeek API error: ${error}`);
    }

    const data = await response.json();

    if (!data.choices || data.choices.length === 0) {
      throw new Error('No response from DeepSeek API');
    }

    return {
      content: data.choices[0].message.content,
      usage: data.usage
        ? {
            inputTokens: data.usage.prompt_tokens,
            outputTokens: data.usage.completion_tokens,
          }
        : undefined,
    };
  }
}

/**
 * Helper function to get user's LLM configuration from profile
 */
export async function getUserLLMConfig(
  supabase: any,
  userId: string
): Promise<LLMConfig | null> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('selected_llm_provider, anthropic_api_key, google_api_key, openai_api_key, deepseek_api_key, anthropic_model, google_model, openai_model, deepseek_model')
    .eq('id', userId)
    .single();

  console.log('=== getUserLLMConfig Debug ===');
  console.log('User ID:', userId);
  console.log('Profile data:', profile ? {
    provider: profile.selected_llm_provider,
    anthropic_model: profile.anthropic_model,
    google_model: profile.google_model,
    openai_model: profile.openai_model,
    deepseek_model: profile.deepseek_model,
  } : 'null');
  console.log('Error:', error);

  if (error || !profile) {
    return null;
  }

  const provider = profile.selected_llm_provider || 'anthropic';
  let apiKey: string | null = null;
  let model: string | undefined = undefined;

  switch (provider) {
    case 'anthropic':
      apiKey = profile.anthropic_api_key;
      model = profile.anthropic_model;
      break;
    case 'google':
      apiKey = profile.google_api_key;
      model = profile.google_model;
      break;
    case 'openai':
      apiKey = profile.openai_api_key;
      model = profile.openai_model;
      break;
    case 'deepseek':
      apiKey = profile.deepseek_api_key;
      model = profile.deepseek_model;
      break;
  }

  console.log('Selected provider:', provider);
  console.log('Selected model:', model);
  console.log('Has API key:', !!apiKey);

  if (!apiKey) {
    return null;
  }

  const config = {
    provider,
    apiKey,
    model,
  };

  console.log('Returning config:', { provider: config.provider, hasApiKey: !!config.apiKey, model: config.model });

  return config;
}
