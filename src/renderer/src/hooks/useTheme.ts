import { useEffect, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import type { Theme } from '../store/types'

function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function useTheme(): {
  theme: Theme
  setTheme: (t: Theme) => void
  isDark: boolean
  systemDark: boolean
} {
  const theme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)

  // Track the OS preference in state so it's a real reactive input — reading the
  // DOM during render would give us a stale value that React can't subscribe to.
  const [systemDark, setSystemDark] = useState<boolean>(systemPrefersDark)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    // Sync once in case the preference changed between module load and mount.
    setSystemDark(mq.matches)
    const handler = (): void => setSystemDark(mq.matches)
    mq.addEventListener?.('change', handler)
    return () => mq.removeEventListener?.('change', handler)
  }, [])

  // Derive the effective dark state from inputs React can see. This is what the
  // UI (e.g. the toggle icon) should read — it updates in the same render as the
  // state change, rather than lagging by a tick.
  const isDark = theme === 'dark' || (theme === 'system' && systemDark)

  // Mirror the derived value into the <html> class. Using `isDark` as the dep
  // keeps the DOM in lockstep with the value the UI is rendering against.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
  }, [isDark])

  return { theme, setTheme, isDark, systemDark }
}
