'use client'

import { useState } from 'react'
import { VocabularyEntry, WordType, Difficulty, Gender, GrammaticalCase } from '@/types/vocabulary'

interface WordEditFormProps {
  word: VocabularyEntry
  onSave: (updatedWord: VocabularyEntry) => void
  onCancel: () => void
}

export default function WordEditForm({ word, onSave, onCancel }: WordEditFormProps) {
  const [formData, setFormData] = useState<VocabularyEntry>(word)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave(formData)
    } finally {
      setSaving(false)
    }
  }

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const updateNestedField = (parent: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [parent]: {
        ...(prev as any)[parent],
        [field]: value
      }
    }))
  }

  const updateEnglishTranslation = (index: number, value: string) => {
    const newEnglish = [...formData.english]
    newEnglish[index] = value
    updateField('english', newEnglish)
  }

  const addEnglishTranslation = () => {
    updateField('english', [...formData.english, ''])
  }

  const removeEnglishTranslation = (index: number) => {
    const newEnglish = formData.english.filter((_, i) => i !== index)
    updateField('english', newEnglish)
  }

  const updateExample = (index: number, field: 'german' | 'english', value: string) => {
    const newExamples = [...(formData.examples || [])]
    newExamples[index] = { ...newExamples[index], [field]: value }
    updateField('examples', newExamples)
  }

  const addExample = () => {
    updateField('examples', [...(formData.examples || []), { german: '', english: '' }])
  }

  const removeExample = (index: number) => {
    const newExamples = (formData.examples || []).filter((_, i) => i !== index)
    updateField('examples', newExamples)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="sticky top-0 bg-white border-b px-8 py-6 z-10">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">Edit Word</h2>
              <button
                type="button"
                onClick={onCancel}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
              >
                ×
              </button>
            </div>
          </div>

          {/* Form Content */}
          <div className="px-8 py-6 space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  German Word *
                </label>
                <input
                  type="text"
                  required
                  value={formData.german}
                  onChange={(e) => updateField('german', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Word Type *
                </label>
                <select
                  required
                  value={formData.type}
                  onChange={(e) => updateField('type', e.target.value as WordType)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="noun">Noun</option>
                  <option value="verb">Verb</option>
                  <option value="adjective">Adjective</option>
                  <option value="adverb">Adverb</option>
                  <option value="pronoun">Pronoun</option>
                  <option value="article">Article</option>
                  <option value="preposition">Preposition</option>
                  <option value="conjunction">Conjunction</option>
                  <option value="expression">Expression</option>
                  <option value="collocation">Collocation</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Difficulty Level
                </label>
                <select
                  value={formData.difficulty || ''}
                  onChange={(e) => updateField('difficulty', e.target.value as Difficulty || undefined)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Not specified</option>
                  <option value="A1">A1</option>
                  <option value="A2">A2</option>
                  <option value="B1">B1</option>
                  <option value="B2">B2</option>
                  <option value="C1">C1</option>
                  <option value="C2">C2</option>
                </select>
              </div>

              {/* English Translations */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  English Translations *
                </label>
                {formData.english.map((translation, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      required
                      value={translation}
                      onChange={(e) => updateEnglishTranslation(index, e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {formData.english.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeEnglishTranslation(index)}
                        className="px-3 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addEnglishTranslation}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  + Add Translation
                </button>
              </div>
            </div>

            {/* Type-specific fields for Nouns */}
            {formData.type === 'noun' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Noun Details</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Article
                    </label>
                    <select
                      value={'article' in formData ? formData.article || '' : ''}
                      onChange={(e) => updateField('article', e.target.value || undefined)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Not specified</option>
                      <option value="der">der</option>
                      <option value="die">die</option>
                      <option value="das">das</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Gender
                    </label>
                    <select
                      value={'gender' in formData ? formData.gender || '' : ''}
                      onChange={(e) => updateField('gender', e.target.value as Gender || undefined)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Not specified</option>
                      <option value="masculine">Masculine</option>
                      <option value="feminine">Feminine</option>
                      <option value="neuter">Neuter</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Plural Form
                  </label>
                  <input
                    type="text"
                    value={'plural' in formData ? formData.plural || '' : ''}
                    onChange={(e) => updateField('plural', e.target.value || undefined)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Genitive Form
                  </label>
                  <input
                    type="text"
                    value={'genitive' in formData ? formData.genitive || '' : ''}
                    onChange={(e) => updateField('genitive', e.target.value || undefined)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            {/* Type-specific fields for Verbs */}
            {formData.type === 'verb' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Verb Details</h3>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Auxiliary Verb
                  </label>
                  <select
                    value={'auxiliary' in formData ? formData.auxiliary || '' : ''}
                    onChange={(e) => updateField('auxiliary', e.target.value || undefined)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Not specified</option>
                    <option value="haben">haben</option>
                    <option value="sein">sein</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Past Participle (Perfect)
                  </label>
                  <input
                    type="text"
                    value={'conjugation' in formData ? formData.conjugation?.perfect || '' : ''}
                    onChange={(e) => updateNestedField('conjugation', 'perfect', e.target.value || undefined)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={'separable' in formData ? formData.separable?.isSeparable || false : false}
                      onChange={(e) => updateField('separable', {
                        isSeparable: e.target.checked,
                        prefix: 'separable' in formData ? formData.separable?.prefix : undefined
                      })}
                      className="rounded"
                    />
                    <span className="text-sm font-medium text-gray-700">Separable Verb</span>
                  </label>
                </div>

                {'separable' in formData && formData.separable?.isSeparable && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Separable Prefix
                    </label>
                    <input
                      type="text"
                      value={formData.separable?.prefix || ''}
                      onChange={(e) => updateNestedField('separable', 'prefix', e.target.value || undefined)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                <div>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={'reflexive' in formData ? formData.reflexive?.isReflexive || false : false}
                      onChange={(e) => updateField('reflexive', {
                        isReflexive: e.target.checked,
                        reflexiveCase: 'reflexive' in formData ? formData.reflexive?.reflexiveCase : 'accusative'
                      })}
                      className="rounded"
                    />
                    <span className="text-sm font-medium text-gray-700">Reflexive Verb</span>
                  </label>
                </div>

                {'reflexive' in formData && formData.reflexive?.isReflexive && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Reflexive Case
                    </label>
                    <select
                      value={formData.reflexive?.reflexiveCase || 'accusative'}
                      onChange={(e) => updateNestedField('reflexive', 'reflexiveCase', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="accusative">Accusative</option>
                      <option value="dative">Dative</option>
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Type-specific fields for Adjectives */}
            {formData.type === 'adjective' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Adjective Details</h3>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Comparative Form
                  </label>
                  <input
                    type="text"
                    value={'comparative' in formData ? formData.comparative || '' : ''}
                    onChange={(e) => updateField('comparative', e.target.value || undefined)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Superlative Form
                  </label>
                  <input
                    type="text"
                    value={'superlative' in formData ? formData.superlative || '' : ''}
                    onChange={(e) => updateField('superlative', e.target.value || undefined)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            {/* Type-specific fields for Prepositions */}
            {formData.type === 'preposition' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Preposition Details</h3>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Governs Case
                  </label>
                  <div className="space-y-2">
                    {(['accusative', 'dative', 'genitive'] as GrammaticalCase[]).map(caseOption => (
                      <label key={caseOption} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={'governsCase' in formData ? formData.governsCase?.includes(caseOption) || false : false}
                          onChange={(e) => {
                            const current = 'governsCase' in formData ? formData.governsCase || [] : []
                            const updated = e.target.checked
                              ? [...current, caseOption]
                              : current.filter(c => c !== caseOption)
                            updateField('governsCase', updated)
                          }}
                          className="rounded"
                        />
                        <span className="text-sm text-gray-700 capitalize">{caseOption}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={'twoWay' in formData ? formData.twoWay || false : false}
                      onChange={(e) => updateField('twoWay', e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm font-medium text-gray-700">Two-way Preposition</span>
                  </label>
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={formData.notes || ''}
                onChange={(e) => updateField('notes', e.target.value || undefined)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Examples */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Example Sentences
              </label>
              {(formData.examples || []).map((example, index) => (
                <div key={index} className="mb-4 p-4 bg-gray-50 rounded-md">
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="German example"
                      value={example.german}
                      onChange={(e) => updateExample(index, 'german', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      placeholder="English translation"
                      value={example.english}
                      onChange={(e) => updateExample(index, 'english', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeExample(index)}
                    className="mt-2 text-sm text-red-600 hover:text-red-700"
                  >
                    Remove Example
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addExample}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                + Add Example
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-gray-50 border-t px-8 py-4 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
