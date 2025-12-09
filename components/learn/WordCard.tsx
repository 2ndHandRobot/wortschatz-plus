'use client'

import { VocabularyEntry } from '@/types/vocabulary'

interface WordCardProps {
  word: VocabularyEntry
  hiddenItems?: Set<string>
  onToggleInfo?: (infoKey: string) => void
  mode?: 'revise' | 'recall' | 'practice'
  headerButton?: React.ReactNode
}

export default function WordCard({ word, hiddenItems = new Set(), onToggleInfo, mode = 'revise', headerButton }: WordCardProps) {
  const isHidden = (key: string) => hiddenItems.has(key)

  const InfoField = ({ label, value, infoKey }: { label: string; value: string | undefined; infoKey: string }) => {
    if (!value) return null

    const hidden = isHidden(infoKey)
    const canToggle = mode === 'revise' && onToggleInfo

    return (
      <div
        className={`${canToggle ? 'cursor-pointer hover:bg-gray-50' : ''} p-3 rounded transition-colors`}
        onClick={() => canToggle && onToggleInfo(infoKey)}
      >
        <span className="font-semibold text-gray-700">{label}: </span>
        {hidden ? (
          <span className="inline-block bg-gray-300 text-transparent select-none rounded px-2">
            {value}
          </span>
        ) : (
          <span className="text-gray-900">{value}</span>
        )}
      </div>
    )
  }

  const InfoList = ({ label, values, infoKey }: { label: string; values: string[] | undefined; infoKey: string }) => {
    if (!values || values.length === 0) return null

    const hidden = isHidden(infoKey)
    const canToggle = mode === 'revise' && onToggleInfo

    return (
      <div
        className={`${canToggle ? 'cursor-pointer hover:bg-gray-50' : ''} p-3 rounded transition-colors`}
        onClick={() => canToggle && onToggleInfo(infoKey)}
      >
        <span className="font-semibold text-gray-700">{label}: </span>
        {hidden ? (
          <span className="inline-block bg-gray-300 text-transparent select-none rounded px-2">
            {values.join(', ')}
          </span>
        ) : (
          <span className="text-gray-900">{values.join(', ')}</span>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-8">
      {/* Main Word */}
      <div className="mb-6 pb-6 border-b">
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1">
            <h2 className="text-4xl font-bold text-gray-900 mb-2">
              {word.type === 'noun' && 'article' in word && word.article ? `${word.article} ` : ''}{word.german}
            </h2>
            <p className="text-lg text-gray-600">
              {word.type.charAt(0).toUpperCase() + word.type.slice(1)}
              {word.difficulty && <span> • {word.difficulty}</span>}
            </p>
          </div>
          {headerButton && (
            <div className="flex-shrink-0">
              {headerButton}
            </div>
          )}
        </div>
      </div>

      {/* Translations */}
      <InfoList label="English" values={word.english} infoKey="english" />

      {/* Type-specific information */}
      {word.type === 'noun' && 'article' in word && (
        <>
          <InfoField label="Article" value={word.article} infoKey="article" />
          <InfoField label="Gender" value={word.gender} infoKey="gender" />
          <InfoField label="Plural" value={word.plural} infoKey="plural" />
          <InfoField label="Genitive" value={word.genitive} infoKey="genitive" />
        </>
      )}

      {word.type === 'verb' && 'auxiliary' in word && (
        <>
          <InfoField label="Auxiliary" value={word.auxiliary} infoKey="auxiliary" />
          {word.conjugation?.perfect && (
            <InfoField label="Past Participle" value={word.conjugation.perfect} infoKey="perfect" />
          )}
          {word.conjugation?.present && (
            <div className="p-3">
              <span className="font-semibold text-gray-700 block mb-2">Present Tense:</span>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {word.conjugation.present.ich && <div>ich: {word.conjugation.present.ich}</div>}
                {word.conjugation.present.du && <div>du: {word.conjugation.present.du}</div>}
                {word.conjugation.present.er_sie_es && <div>er/sie/es: {word.conjugation.present.er_sie_es}</div>}
                {word.conjugation.present.wir && <div>wir: {word.conjugation.present.wir}</div>}
                {word.conjugation.present.ihr && <div>ihr: {word.conjugation.present.ihr}</div>}
                {word.conjugation.present.sie_Sie && <div>sie/Sie: {word.conjugation.present.sie_Sie}</div>}
              </div>
            </div>
          )}
          {word.separable?.isSeparable && (
            <InfoField label="Separable Prefix" value={word.separable.prefix} infoKey="separable_prefix" />
          )}
          {word.reflexive?.isReflexive && (
            <div className="p-3">
              <span className="font-semibold text-gray-700">Reflexive: </span>
              <span className="text-gray-900">Yes ({word.reflexive.reflexiveCase})</span>
            </div>
          )}
        </>
      )}

      {word.type === 'adjective' && 'comparative' in word && (
        <>
          <InfoField label="Comparative" value={word.comparative} infoKey="comparative" />
          <InfoField label="Superlative" value={word.superlative} infoKey="superlative" />
        </>
      )}

      {word.type === 'preposition' && 'governsCase' in word && word.governsCase && (
        <div className="p-3">
          <span className="font-semibold text-gray-700">Governs Case: </span>
          <span className="text-gray-900">{word.governsCase.join(', ')}</span>
          {word.twoWay && <span className="text-gray-600 ml-2">(two-way preposition)</span>}
        </div>
      )}

      {/* Notes */}
      {word.notes && (
        <div className="p-3 mt-4 bg-yellow-50 border border-yellow-200 rounded">
          <span className="font-semibold text-gray-700 block mb-1">Notes:</span>
          <p className="text-gray-900">{word.notes}</p>
        </div>
      )}

      {/* Examples */}
      {word.examples && word.examples.length > 0 && (
        <div className="mt-6 pt-6 border-t">
          <h3 className="font-semibold text-gray-700 mb-3">Examples:</h3>
          <div className="space-y-3">
            {word.examples.map((example, idx) => (
              <div key={idx} className="bg-gray-50 p-3 rounded">
                <p className="text-gray-900 mb-1">{example.german}</p>
                <p className="text-gray-600 italic text-sm">{example.english}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      {word.tags && word.tags.length > 0 && (
        <div className="mt-4">
          <div className="flex flex-wrap gap-2">
            {word.tags.map((tag, idx) => (
              <span key={idx} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
