import { useEffect, useState } from 'react'

export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'family-hud.theme'

function systemPreference(): Theme {
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

/** Scelta salvata, altrimenti quella di sistema. */
export function resolveInitialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'dark' || stored === 'light' ? stored : systemPreference()
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
}

/**
 * Va chiamata prima del render (da main.tsx): impostare l'attributo solo dentro
 * un effect farebbe apparire il tema di default per un frame, con un lampo
 * scuro su chi usa il tema chiaro.
 */
export function initTheme(): void {
  applyTheme(resolveInitialTheme())
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(resolveInitialTheme)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // Se non c'e' una scelta esplicita, seguiamo il sistema anche quando cambia
  // mentre l'app e' aperta (es. tema automatico al tramonto).
  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return
    const media = window.matchMedia('(prefers-color-scheme: light)')
    const onChange = () => setTheme(systemPreference())
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  function toggle() {
    setTheme((current) => {
      const next: Theme = current === 'dark' ? 'light' : 'dark'
      localStorage.setItem(STORAGE_KEY, next)
      return next
    })
  }

  return { theme, toggle }
}
