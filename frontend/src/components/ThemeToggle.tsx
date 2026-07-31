import { useTheme } from '../theme'
import { useI18n } from '../i18n'

/** Interruttore chiaro/scuro. Usato sia in dashboard che nella schermata di login. */
export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const { t } = useI18n()
  const goingTo = t(theme === 'dark' ? 'theme.light' : 'theme.dark')

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      title={t('theme.switchTo', { mode: goingTo })}
      aria-label={t('theme.switchTo', { mode: goingTo })}
    >
      {theme === 'dark' ? '☀' : '☾'}
    </button>
  )
}
