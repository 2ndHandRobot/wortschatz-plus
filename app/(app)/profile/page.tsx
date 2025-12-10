'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types/vocabulary'
import { LLM_PROVIDERS, LLMProvider } from '@/lib/llm/types'

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [fullName, setFullName] = useState('')
  const [targetTime, setTargetTime] = useState(15)
  const [selectedProvider, setSelectedProvider] = useState<LLMProvider>('anthropic')
  const [apiKeys, setApiKeys] = useState({
    anthropic: '',
    google: '',
    openai: '',
    deepseek: '',
  })
  const [selectedModels, setSelectedModels] = useState({
    anthropic: 'claude-haiku-4-5-20251001',
    google: 'gemini-2.5-flash-latest',
    openai: 'gpt-4o-mini',
    deepseek: 'deepseek-chat',
  })
  const [availableModels, setAvailableModels] = useState<Record<LLMProvider, string[]>>({
    anthropic: [],
    google: [],
    openai: [],
    deepseek: [],
  })
  const [loadingModels, setLoadingModels] = useState<Record<LLMProvider, boolean>>({
    anthropic: false,
    google: false,
    openai: false,
    deepseek: false,
  })
  const [testingConnection, setTestingConnection] = useState<Record<LLMProvider, boolean>>({
    anthropic: false,
    google: false,
    openai: false,
    deepseek: false,
  })
  const [testResults, setTestResults] = useState<Record<LLMProvider, { success: boolean; message: string } | null>>({
    anthropic: null,
    google: null,
    openai: null,
    deepseek: null,
  })
  const [showApiKeys, setShowApiKeys] = useState({
    anthropic: false,
    google: false,
    openai: false,
    deepseek: false,
  })

  const supabase = createClient()

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) throw new Error('Not authenticated')

      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (fetchError) {
        // Profile doesn't exist, create it
        if (fetchError.code === 'PGRST116') {
          const { error: createError } = await supabase.from('profiles').insert({
            id: user.id,
            email: user.email || '',
            target_daily_learning_time: 15,
          })

          if (createError) throw createError

          // Fetch again after creation
          const { data: newData, error: refetchError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single()

          if (refetchError) throw refetchError

          setProfile(newData)
          setFullName(newData.full_name || '')
          setTargetTime(newData.target_daily_learning_time || 15)
          setSelectedProvider(newData.selected_llm_provider || 'anthropic')
          setApiKeys({
            anthropic: newData.anthropic_api_key || '',
            google: newData.google_api_key || '',
            openai: newData.openai_api_key || '',
            deepseek: newData.deepseek_api_key || '',
          })
          setSelectedModels({
            anthropic: newData.anthropic_model || 'claude-haiku-4-5-20251001',
            google: newData.google_model || 'gemini-1.5-flash-latest',
            openai: newData.openai_model || 'gpt-4o-mini',
            deepseek: newData.deepseek_model || 'deepseek-chat',
          })
        } else {
          throw fetchError
        }
      } else {
        setProfile(data)
        setFullName(data.full_name || '')
        setTargetTime(data.target_daily_learning_time || 15)
        setSelectedProvider(data.selected_llm_provider || 'anthropic')
        setApiKeys({
          anthropic: data.anthropic_api_key || '',
          google: data.google_api_key || '',
          openai: data.openai_api_key || '',
          deepseek: data.deepseek_api_key || '',
        })
        setSelectedModels({
          anthropic: data.anthropic_model || 'claude-haiku-4-5-20251001',
          google: data.google_model || 'gemini-1.5-flash-latest',
          openai: data.openai_model || 'gpt-4o-mini',
          deepseek: data.deepseek_model || 'deepseek-chat',
        })
      }
    } catch (err) {
      console.error('Profile fetch error:', err)
      setError(err instanceof Error ? err.message : 'Failed to load profile')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) throw new Error('Not authenticated')

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName || null,
          target_daily_learning_time: targetTime,
          selected_llm_provider: selectedProvider,
          anthropic_api_key: apiKeys.anthropic || null,
          google_api_key: apiKeys.google || null,
          openai_api_key: apiKeys.openai || null,
          deepseek_api_key: apiKeys.deepseek || null,
          anthropic_model: selectedModels.anthropic,
          google_model: selectedModels.google,
          openai_model: selectedModels.openai,
          deepseek_model: selectedModels.deepseek,
        })
        .eq('id', user.id)

      if (updateError) throw updateError

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  const loadModelsForProvider = async (provider: LLMProvider) => {
    const apiKey = apiKeys[provider]
    if (!apiKey) {
      setTestResults({
        ...testResults,
        [provider]: { success: false, message: 'Please enter an API key first' },
      })
      return
    }

    setLoadingModels({ ...loadingModels, [provider]: true })
    setTestResults({ ...testResults, [provider]: null })

    try {
      const response = await fetch('/api/llm/list-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey }),
      })

      const data = await response.json()

      if (response.ok && data.models) {
        setAvailableModels({ ...availableModels, [provider]: data.models })
        if (data.models.length > 0 && !selectedModels[provider]) {
          setSelectedModels({ ...selectedModels, [provider]: data.models[0] })
        }
        setTestResults({
          ...testResults,
          [provider]: { success: true, message: `Found ${data.models.length} models` },
        })
      } else {
        throw new Error(data.error || 'Failed to load models')
      }
    } catch (error) {
      console.error(`Error loading ${provider} models:`, error)
      setTestResults({
        ...testResults,
        [provider]: {
          success: false,
          message: error instanceof Error ? error.message : 'Failed to load models',
        },
      })
    } finally {
      setLoadingModels({ ...loadingModels, [provider]: false })
    }
  }

  const autoSaveModel = async (provider: LLMProvider, model: string) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const modelField = `${provider}_model` as const
      await supabase
        .from('profiles')
        .update({ [modelField]: model })
        .eq('id', user.id)

      console.log(`Auto-saved ${provider} model: ${model}`)
    } catch (err) {
      console.error('Auto-save failed:', err)
    }
  }

  const testConnection = async (provider: LLMProvider) => {
    const apiKey = apiKeys[provider]
    if (!apiKey) {
      setTestResults({
        ...testResults,
        [provider]: { success: false, message: 'Please enter an API key first' },
      })
      return
    }

    setTestingConnection({ ...testingConnection, [provider]: true })
    setTestResults({ ...testResults, [provider]: null })

    try {
      const response = await fetch('/api/llm/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey, model: selectedModels[provider] }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setTestResults({
          ...testResults,
          [provider]: { success: true, message: data.message || 'Connection successful!' },
        })
        // Also load models if not already loaded
        if (availableModels[provider].length === 0) {
          await loadModelsForProvider(provider)
        }
      } else {
        throw new Error(data.error || 'Connection failed')
      }
    } catch (error) {
      console.error(`Error testing ${provider} connection:`, error)
      setTestResults({
        ...testResults,
        [provider]: {
          success: false,
          message: error instanceof Error ? error.message : 'Connection failed',
        },
      })
    } finally {
      setTestingConnection({ ...testingConnection, [provider]: false })
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="text-center">
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Profile Settings</h1>
        <p className="text-gray-600">Manage your account and learning preferences</p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <form onSubmit={handleSave} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <p className="text-sm text-green-800">Profile updated successfully!</p>
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Email
            </label>
            <input
              type="email"
              id="email"
              value={profile?.email || ''}
              disabled
              className="w-full px-4 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
            />
            <p className="mt-1 text-sm text-gray-500">Email cannot be changed</p>
          </div>

          <div>
            <label
              htmlFor="fullName"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Full Name
            </label>
            <input
              type="text"
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your name"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="targetTime"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Target Daily Learning Time (minutes)
            </label>
            <input
              type="number"
              id="targetTime"
              value={targetTime}
              onChange={(e) => setTargetTime(parseInt(e.target.value) || 15)}
              min="5"
              max="120"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-1 text-sm text-gray-500">
              How many minutes per day you want to spend learning (5-120 minutes)
            </p>
          </div>

          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              AI Assistant Configuration
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Configure which AI provider to use for word lookup, translations, and practice
              exercises. You can configure multiple providers and switch between them.
            </p>

            <div className="mb-4">
              <label
                htmlFor="llmProvider"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Active AI Provider
              </label>
              <select
                id="llmProvider"
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value as LLMProvider)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                {Object.values(LLM_PROVIDERS).map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name} - {provider.description}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-sm text-gray-500">
                Select which AI provider to use for generating content
              </p>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-gray-900">API Keys</h4>
              <p className="text-sm text-gray-600">
                Configure API keys for the providers you want to use. At minimum, configure the
                key for your selected provider above.
              </p>

              {Object.values(LLM_PROVIDERS).map((provider) => {
                const isSelected = provider.id === selectedProvider
                return (
                  <div
                    key={provider.id}
                    className={`border rounded-lg p-4 ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <label
                        htmlFor={`apiKey-${provider.id}`}
                        className="block text-sm font-medium text-gray-700"
                      >
                        {provider.name}
                        {isSelected && (
                          <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">
                            Active
                          </span>
                        )}
                      </label>
                    </div>
                    <div className="relative">
                      <input
                        type={showApiKeys[provider.id] ? 'text' : 'password'}
                        id={`apiKey-${provider.id}`}
                        value={apiKeys[provider.id]}
                        onChange={(e) =>
                          setApiKeys({ ...apiKeys, [provider.id]: e.target.value })
                        }
                        placeholder={provider.apiKeyPlaceholder}
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowApiKeys({
                            ...showApiKeys,
                            [provider.id]: !showApiKeys[provider.id],
                          })
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 hover:text-gray-700"
                      >
                        {showApiKeys[provider.id] ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                      Get your API key from{' '}
                      <a
                        href={provider.apiKeyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800"
                      >
                        {provider.apiKeyUrl.replace('https://', '')}
                      </a>
                    </p>

                    {/* Model Selection */}
                    <div className="mt-4">
                      <label
                        htmlFor={`model-${provider.id}`}
                        className="block text-sm font-medium text-gray-700 mb-2"
                      >
                        Model
                      </label>
                      <div className="flex gap-2">
                        <select
                          id={`model-${provider.id}`}
                          value={selectedModels[provider.id]}
                          onChange={(e) => {
                            const newModel = e.target.value
                            setSelectedModels({
                              ...selectedModels,
                              [provider.id]: newModel,
                            })
                            autoSaveModel(provider.id, newModel)
                          }}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                        >
                          {availableModels[provider.id].length > 0 ? (
                            availableModels[provider.id].map((model) => (
                              <option key={model} value={model}>
                                {model}
                              </option>
                            ))
                          ) : (
                            <option value={selectedModels[provider.id]}>
                              {selectedModels[provider.id]}
                            </option>
                          )}
                        </select>
                        <button
                          type="button"
                          onClick={() => loadModelsForProvider(provider.id)}
                          disabled={loadingModels[provider.id] || !apiKeys[provider.id]}
                          className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {loadingModels[provider.id] ? 'Loading...' : 'Load Models'}
                        </button>
                      </div>
                    </div>

                    {/* Test Connection Button */}
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => testConnection(provider.id)}
                        disabled={testingConnection[provider.id] || !apiKeys[provider.id]}
                        className="w-full px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {testingConnection[provider.id] ? 'Testing...' : 'Test Connection'}
                      </button>
                    </div>

                    {/* Test Results */}
                    {testResults[provider.id] && (
                      <div
                        className={`mt-2 p-2 rounded text-sm ${
                          testResults[provider.id]?.success
                            ? 'bg-green-50 text-green-800 border border-green-200'
                            : 'bg-red-50 text-red-800 border border-red-200'
                        }`}
                      >
                        {testResults[provider.id]?.message}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <h3 className="font-semibold text-yellow-800 mb-2">Security & Privacy</h3>
        <p className="text-sm text-yellow-700 mb-2">
          Your API keys are required for AI-powered features including word lookup, translations,
          and practice exercise generation. They are stored securely in the database with
          row-level security.
        </p>
        <p className="text-sm text-yellow-700">
          <strong>Note:</strong> In production, API keys should be encrypted. Your keys are only
          accessible to you and are never shared with third parties except the AI provider you
          selected.
        </p>
      </div>
    </div>
  )
}
