import { NextResponse } from 'next/server';
import { LLMProvider } from '@/lib/llm/types';

export async function POST(request: Request) {
  try {
    const { provider, apiKey } = await request.json();

    if (!provider || !apiKey) {
      return NextResponse.json(
        { error: 'Provider and API key are required' },
        { status: 400 }
      );
    }

    let models: string[] = [];

    switch (provider as LLMProvider) {
      case 'anthropic':
        models = await listAnthropicModels(apiKey);
        break;
      case 'google':
        models = await listGoogleModels(apiKey);
        break;
      case 'openai':
        models = await listOpenAIModels(apiKey);
        break;
      case 'deepseek':
        models = await listDeepSeekModels(apiKey);
        break;
      default:
        return NextResponse.json(
          { error: 'Unsupported provider' },
          { status: 400 }
        );
    }

    return NextResponse.json({ models });
  } catch (error) {
    console.error('List models error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to list models',
      },
      { status: 500 }
    );
  }
}

async function listAnthropicModels(apiKey: string): Promise<string[]> {
  // Anthropic doesn't have a models list endpoint, return known models
  return [
    'claude-opus-4-5-20251101',
    'claude-sonnet-4-5-20250929',
    'claude-haiku-4-5-20251001',
    'claude-3-7-sonnet-20250219',
  ];
}

async function listGoogleModels(apiKey: string): Promise<string[]> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models?key=${apiKey.trim()}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Google API error: ${await response.text()}`);
    }

    const data = await response.json();

    // Filter for models that support generateContent
    const models = data.models
      .filter((model: any) =>
        model.supportedGenerationMethods?.includes('generateContent')
      )
      .map((model: any) => model.name.replace('models/', ''))
      .filter((name: string) => name.startsWith('gemini'));

    return models;
  } catch (error) {
    console.error('Error listing Google models:', error);
    // Return fallback models
    return [
      'gemini-1.5-flash-latest',
      'gemini-1.5-flash',
      'gemini-1.5-pro-latest',
      'gemini-1.5-pro',
      'gemini-2.0-flash-exp',
    ];
  }
}

async function listOpenAIModels(apiKey: string): Promise<string[]> {
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
      },
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${await response.text()}`);
    }

    const data = await response.json();

    // Filter for chat models
    const models = data.data
      .map((model: any) => model.id)
      .filter((id: string) =>
        id.startsWith('gpt-4') ||
        id.startsWith('gpt-3.5') ||
        id.startsWith('o1') ||
        id.startsWith('o3')
      )
      .sort();

    return models;
  } catch (error) {
    console.error('Error listing OpenAI models:', error);
    // Return fallback models
    return [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'gpt-4',
      'gpt-3.5-turbo',
      'o1',
      'o1-mini',
    ];
  }
}

async function listDeepSeekModels(apiKey: string): Promise<string[]> {
  try {
    const response = await fetch('https://api.deepseek.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
      },
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${await response.text()}`);
    }

    const data = await response.json();
    const models = data.data.map((model: any) => model.id);
    return models;
  } catch (error) {
    console.error('Error listing DeepSeek models:', error);
    // Return fallback models
    return ['deepseek-chat', 'deepseek-coder'];
  }
}
