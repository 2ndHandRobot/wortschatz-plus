'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types/vocabulary'

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [fullName, setFullName] = useState('')
  const [targetTime, setTargetTime] = useState(15)
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)

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
          setApiKey(newData.claude_api_key || '')
        } else {
          throw fetchError
        }
      } else {
        setProfile(data)
        setFullName(data.full_name || '')
        setTargetTime(data.target_daily_learning_time || 15)
        setApiKey(data.claude_api_key || '')
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
          claude_api_key: apiKey || null,
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

          <div>
            <label
              htmlFor="apiKey"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Claude API Key
            </label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                id="apiKey"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ant-..."
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 hover:text-gray-700"
              >
                {showApiKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Get your API key from{' '}
              <a
                href="https://console.anthropic.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800"
              >
                console.anthropic.com
              </a>
            </p>
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
        <h3 className="font-semibold text-yellow-800 mb-2">Important Note</h3>
        <p className="text-sm text-yellow-700">
          Your Claude API key is required for word lookup and practice exercise generation.
          It is stored securely in the database. In production, this should be encrypted.
        </p>
      </div>
    </div>
  )
}
