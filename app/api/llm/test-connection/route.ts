import { NextResponse } from 'next/server';
import { LLMService } from '@/lib/llm/service';
import { LLMProvider } from '@/lib/llm/types';

export async function POST(request: Request) {
  try {
    const { provider, apiKey, model } = await request.json();

    if (!provider || !apiKey) {
      return NextResponse.json(
        { error: 'Provider and API key are required' },
        { status: 400 }
      );
    }

    console.log(`Testing ${provider} connection...`);

    const llmService = new LLMService({
      provider: provider as LLMProvider,
      apiKey: apiKey.trim(),
      model: model || undefined, // Use the selected model if provided
    });

    // Test with a simple prompt
    const response = await llmService.generateCompletion(
      [
        {
          role: 'user',
          content: 'Respond with exactly: "Connection successful"',
        },
      ],
      { maxTokens: 50, model: 'fast' }
    );

    console.log('Test successful:', response.content.substring(0, 50));

    return NextResponse.json({
      success: true,
      message: `${provider} API is working!`,
      response: response.content,
      usage: response.usage,
    });
  } catch (error) {
    console.error('Test connection error:', error);

    let errorMessage = 'Connection failed';
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
