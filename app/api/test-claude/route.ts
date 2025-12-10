import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getUserLLMConfig, LLMService } from '@/lib/llm/service'

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const llmConfig = await getUserLLMConfig(supabase, user.id)

    if (!llmConfig) {
      return NextResponse.json(
        { error: 'AI provider not configured. Please add an API key in your profile.' },
        { status: 400 }
      )
    }

    console.log(`=== ${llmConfig.provider.toUpperCase()} API Test ===`)
    console.log('API Key prefix:', llmConfig.apiKey.substring(0, 20) + '...')
    console.log('API Key length:', llmConfig.apiKey.length)
    console.log(`Making test request to ${llmConfig.provider} API...`)

    const llmService = new LLMService(llmConfig)

    const response = await llmService.generateCompletion(
      [
        {
          role: 'user',
          content: 'Say "Hello" in one word.',
        },
      ],
      { maxTokens: 50, model: 'fast' }
    )

    console.log('Success! Response received from AI provider')

    return NextResponse.json({
      success: true,
      message: `${llmConfig.provider} API is working!`,
      response: response.content,
      provider: llmConfig.provider,
      apiKeyPrefix: llmConfig.apiKey.substring(0, 20) + '...',
      usage: response.usage,
    })
  } catch (error) {
    console.error('=== AI API Test Error ===')
    console.error('Error type:', error?.constructor?.name)
    console.error('Error message:', error instanceof Error ? error.message : String(error))
    console.error('Full error:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorType: error?.constructor?.name,
      },
      { status: 500 }
    )
  }
}
