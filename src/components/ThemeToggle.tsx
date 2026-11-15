'use client'

import { useSyncExternalStore } from 'react'

export type Theme = 'day' | 'night' | 'muted'

export const THEME_KEY = 'sg-theme'
const THEME_COLORS: Record<Theme, string> = { day: '#efece4', night: '#05060a', muted: '#eceae6' }
const ORDER: Theme[] = ['day', 'night', 'muted']
const NAMES: Record<Theme, string> = { day: 'Day', night: 'Night', muted: 'Muted' }

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  return () => observer.disconnect()
}

function currentTheme(): Theme {
  const t = document.documentElement.dataset.theme as Theme
  return ORDER.includes(t) ? t : 'day'
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
  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length]

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={() => applyTheme(next)}
      aria-label={`Look: ${NAMES[theme]}. Switch to ${NAMES[next]}`}
      title={`Switch to ${NAMES[next]}`}
    >
      {NAMES[theme]}
    </button>
  )
}
