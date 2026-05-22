import { Settings } from 'lucide-react'
import { Button } from './ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from './ui/dropdown-menu'
import { useTheme } from '../hooks/useTheme'
import { useAppStore } from '../store/useAppStore'
import type { Theme } from '../store/types'

const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'Match system' }
]

/**
 * Replaces the standalone theme toggle. The trigger is a single Settings cog
 * — the menu collects every app-level preference (theme + remember-session
 * today, more as we grow). Earlier iterations layered Sun/Moon + a corner cog
 * inside the icon button, but Button's `[&_svg]:size-4` rule forces every
 * nested SVG to 16 px, so the overlay can't be made small enough to read as
 * "secondary". One icon, one job.
 */
export function SettingsMenu(): JSX.Element {
  const { theme, setTheme } = useTheme()
  const persistenceEnabled = useAppStore((s) => s.persistenceEnabled)
  const setPersistenceEnabled = useAppStore((s) => s.setPersistenceEnabled)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Settings" title="Settings">
          <Settings />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[12rem]">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as Theme)}>
          {THEME_OPTIONS.map((opt) => (
            <DropdownMenuRadioItem key={opt.value} value={opt.value}>
              {opt.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={persistenceEnabled}
          onCheckedChange={(checked) => setPersistenceEnabled(Boolean(checked))}
        >
          Remember session
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
