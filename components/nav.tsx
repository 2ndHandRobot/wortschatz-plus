'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { Language } from '@/types/vocabulary'

const LANGUAGE_FLAGS: Record<Language, string> = {
  german: '🇩🇪',
  french: '🇫🇷',
  spanish: '🇪🇸',
  italian: '🇮🇹',
  portuguese: '🇵🇹',
  dutch: '🇳🇱',
  swedish: '🇸🇪',
  danish: '🇩🇰',
  norwegian: '🇳🇴',
}

const LANGUAGE_NAMES: Record<Language, string> = {
  german: 'German',
  french: 'French',
  spanish: 'Spanish',
  italian: 'Italian',
  portuguese: 'Portuguese',
  dutch: 'Dutch',
  swedish: 'Swedish',
  danish: 'Danish',
  norwegian: 'Norwegian',
}

export default function Nav() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [targetLanguage, setTargetLanguage] = useState<Language>('german')
  const [userId, setUserId] = useState<string | null>(null)
  const [showLanguageMenu, setShowLanguageMenu] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)

  useEffect(() => {
    fetchUserLanguage()
  }, [])

  const fetchUserLanguage = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        const { data: profile } = await supabase
          .from('profiles')
          .select('target_language')
          .eq('id', user.id)
          .single()

        if (profile?.target_language) {
          setTargetLanguage(profile.target_language as Language)
        }
      }
    } catch (err) {
      console.error('Error fetching user language:', err)
    }
  }

  const handleLanguageChange = async (language: Language) => {
    if (!userId) return

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ target_language: language })
        .eq('id', userId)

      if (error) throw error

      setTargetLanguage(language)
      setShowLanguageMenu(false)

      // Force a full page reload to refresh all content
      window.location.reload()
    } catch (err) {
      console.error('Error updating language:', err)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const isActive = (path: string) => pathname === path

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className="text-xl font-bold text-blue-600">
                WortSchatz+
              </Link>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              <Link
                href="/"
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                  isActive('/')
                    ? 'border-blue-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                Home
              </Link>
              <Link
                href="/dictionary"
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                  isActive('/dictionary')
                    ? 'border-blue-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                Dictionary
              </Link>
              <Link
                href="/learn"
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                  isActive('/learn')
                    ? 'border-blue-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                Learn
              </Link>
              <Link
                href="/lists"
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                  pathname.startsWith('/lists')
                    ? 'border-blue-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                Lists
              </Link>
              <Link
                href="/profile"
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                  isActive('/profile')
                    ? 'border-blue-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                Profile
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* Mobile menu button */}
            <button
              type="button"
              className="sm:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              aria-expanded="false"
            >
              <span className="sr-only">Open main menu</span>
              {showMobileMenu ? (
                <svg className="block h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="block h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>

            {/* Language Selector */}
            <div className="relative">
              <button
                onClick={() => setShowLanguageMenu(!showLanguageMenu)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors"
              >
                <span className="text-xl">{LANGUAGE_FLAGS[targetLanguage]}</span>
                <span className="hidden sm:inline">
                  <span className="text-gray-500">Learning:</span>{' '}
                  <span className="font-semibold">{LANGUAGE_NAMES[targetLanguage]}</span>
                </span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showLanguageMenu && (
                <>
                  {/* Backdrop to close menu */}
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowLanguageMenu(false)}
                  />

                  {/* Dropdown menu */}
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg z-20 border border-gray-200">
                    <div className="py-1">
                      {(Object.keys(LANGUAGE_NAMES) as Language[]).map((lang) => (
                        <button
                          key={lang}
                          onClick={() => handleLanguageChange(lang)}
                          className={`w-full text-left px-4 py-2 text-sm flex items-center gap-3 hover:bg-gray-100 ${
                            lang === targetLanguage ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                          }`}
                        >
                          <span className="text-xl">{LANGUAGE_FLAGS[lang]}</span>
                          <span>{LANGUAGE_NAMES[lang]}</span>
                          {lang === targetLanguage && (
                            <svg className="w-4 h-4 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={handleLogout}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
      {showMobileMenu && (
        <div className="sm:hidden border-t border-gray-200">
          <div className="pt-2 pb-3 space-y-1">
          <Link
            href="/"
            onClick={() => setShowMobileMenu(false)}
            className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
              isActive('/')
                ? 'bg-blue-50 border-blue-500 text-blue-700'
                : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            Home
          </Link>
          <Link
            href="/dictionary"
            onClick={() => setShowMobileMenu(false)}
            className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
              isActive('/dictionary')
                ? 'bg-blue-50 border-blue-500 text-blue-700'
                : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            Dictionary
          </Link>
          <Link
            href="/learn"
            onClick={() => setShowMobileMenu(false)}
            className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
              isActive('/learn')
                ? 'bg-blue-50 border-blue-500 text-blue-700'
                : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            Learn
          </Link>
          <Link
            href="/lists"
            onClick={() => setShowMobileMenu(false)}
            className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
              pathname.startsWith('/lists')
                ? 'bg-blue-50 border-blue-500 text-blue-700'
                : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            Lists
          </Link>
          <Link
            href="/profile"
            onClick={() => setShowMobileMenu(false)}
            className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
              isActive('/profile')
                ? 'bg-blue-50 border-blue-500 text-blue-700'
                : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            Profile
          </Link>
        </div>
      </div>
      )}
    </nav>
  )
}
