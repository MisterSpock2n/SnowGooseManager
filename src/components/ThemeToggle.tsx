'use client'

import { useSyncExternalStore } from 'react'

export type Theme = 'day' | 'night'

export const THEME_KEY = 'sg-theme'
const THEME_COLORS: Record<Theme, string> = { day: '#efece4', night: '#05060a' }

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  return () => observer.disconnect()
}

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'night' ? 'night' : 'day'
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme])
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // Private browsing can block storage; the switch still works for this visit
  }
}

export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, currentTheme, () => 'day' as Theme)
  const next: Theme = theme === 'night' ? 'day' : 'night'

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={() => applyTheme(next)}
      aria-label={`Switch to the ${next === 'night' ? 'Night' : 'Day'} look`}
      title={`Switch to ${next === 'night' ? 'Night' : 'Day'}`}
    >
      {next === 'night' ? 'Night' : 'Day'}
    </button>
  )
}
