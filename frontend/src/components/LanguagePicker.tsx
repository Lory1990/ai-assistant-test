import { useI18n, SUPPORTED_LANGUAGES, type Language } from '../i18n'

const LABEL_KEY = { it: 'language.italian', en: 'language.english' } as const

/** Selettore della lingua, accanto al toggle del tema. */
export function LanguagePicker() {
  const { language, setLanguage, t } = useI18n()

  return (
    <select
      className="language-picker"
      value={language}
      onChange={(e) => setLanguage(e.target.value as Language)}
      aria-label={t('language.label')}
      title={t('language.label')}
    >
      {SUPPORTED_LANGUAGES.map((lang) => (
        <option key={lang} value={lang}>
          {t(LABEL_KEY[lang])}
        </option>
      ))}
    </select>
  )
}
