import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { dictionaries, type Language, type TranslationKey } from './dictionaries'

const STORAGE_KEY = 'family-hud.language'

export const SUPPORTED_LANGUAGES: Language[] = ['it', 'en']

function detectLanguage(): Language {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'it' || stored === 'en') return stored
  // navigator.language è tipo "it-IT": conta solo la parte prima del trattino.
  const preferred = navigator.language.split('-')[0]
  return SUPPORTED_LANGUAGES.includes(preferred as Language) ? (preferred as Language) : 'it'
}

/** Sostituisce i segnaposto {nome} con i valori passati. */
function interpolate(template: string, values?: Record<string, string | number>): string {
  if (!values) return template
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in values ? String(values[key]) : match))
}

interface I18nContextValue {
  language: Language
  setLanguage: (language: Language) => void
  t: (key: TranslationKey, values?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(detectLanguage)

  // Tiene l'attributo lang del documento allineato: conta per gli screen reader
  // e per la sillabazione del browser.
  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  const setLanguage = useCallback((next: Language) => {
    localStorage.setItem(STORAGE_KEY, next)
    setLanguageState(next)
  }, [])

  const t = useCallback(
    (key: TranslationKey, values?: Record<string, string | number>) =>
      interpolate(dictionaries[language][key], values),
    [language],
  )

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext)
  if (!context) throw new Error('useI18n va usato dentro I18nProvider')
  return context
}

export type { Language, TranslationKey }
