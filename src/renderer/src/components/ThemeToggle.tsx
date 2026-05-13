import { Sun, Moon } from 'lucide-react'
import { Button } from './ui/button'
import { useTheme } from '../hooks/useTheme'
import { cn } from '../lib/utils'
import type { Theme } from '../store/types'

const CYCLE: Theme[] = ['light', 'dark', 'system']

function resolvesDark(t: Theme, systemDark: boolean): boolean {
  return t === 'dark' || (t === 'system' && systemDark)
}

export function ThemeToggle(): JSX.Element {
  const { theme, setTheme, isDark, systemDark } = useTheme()

  const next = (): void => {
    // Cycle through light → dark → system, but skip any step whose resolved
    // appearance matches the current one. That way a click always visibly flips
    // the theme — e.g. on a dark-preferring OS, dark → system would look
    // identical, so we jump straight to light.
    const start = CYCLE.indexOf(theme)
    for (let step = 1; step < CYCLE.length; step++) {
      const candidate = CYCLE[(start + step) % CYCLE.length]
      if (resolvesDark(candidate, systemDark) !== isDark) {
        setTheme(candidate)
        return
      }
    }
  }

  const title =
    theme === 'system'
      ? `System (${isDark ? 'dark' : 'light'})`
      : theme === 'dark'
        ? 'Dark'
        : 'Light'

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={next}
      aria-label={`Theme: ${title}. Click to change.`}
      title={`Theme: ${title}`}
    >
      {/* Contextual icon swap — keep both icons mounted and cross-fade them so
          enter AND exit both animate (no framer-motion in the project). Values
          per the make-interfaces-feel-better skill: scale 0.25→1, opacity 0→1,
          blur 4px→0, cubic-bezier(0.2, 0, 0, 1). */}
      <span className="relative inline-flex h-4 w-4 items-center justify-center">
        <Sun
          className={cn(
            'absolute inset-0 transition-[opacity,filter,scale] duration-300',
            isDark ? 'scale-[0.25] opacity-0 blur-[4px]' : 'scale-100 opacity-100 blur-0'
          )}
          style={{ transitionTimingFunction: 'cubic-bezier(0.2, 0, 0, 1)' }}
        />
        <Moon
          className={cn(
            'absolute inset-0 transition-[opacity,filter,scale] duration-300',
            isDark ? 'scale-100 opacity-100 blur-0' : 'scale-[0.25] opacity-0 blur-[4px]'
          )}
          style={{ transitionTimingFunction: 'cubic-bezier(0.2, 0, 0, 1)' }}
        />
      </span>
    </Button>
  )
}
