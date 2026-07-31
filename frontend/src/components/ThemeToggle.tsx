import { useTheme } from '../theme'

/** Interruttore chiaro/scuro. Usato sia in dashboard che nella schermata di login. */
export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const goingTo = theme === 'dark' ? 'chiaro' : 'scuro'

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      title={`Passa al tema ${goingTo}`}
      aria-label={`Passa al tema ${goingTo}`}
    >
      {theme === 'dark' ? '☀' : '☾'}
    </button>
  )
}
