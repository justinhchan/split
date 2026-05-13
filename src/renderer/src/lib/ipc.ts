/**
 * Thin renderer-side shim over window.api (exposed in preload). Falls back to
 * localStorage when window.api is missing — handy for vitest/jsdom.
 */

export interface PersistedPayload {
  version: 1
  data: Record<string, unknown>
}

const LS_KEY = 'split-state'

function hasApi(): boolean {
  return typeof window !== 'undefined' && typeof window.api?.loadState === 'function'
}

export async function loadState(): Promise<PersistedPayload> {
  if (hasApi()) return window.api.loadState()
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LS_KEY) : null
    if (!raw) return { version: 1, data: {} }
    const parsed = JSON.parse(raw) as PersistedPayload
    if (typeof parsed?.version !== 'number') return { version: 1, data: {} }
    return parsed
  } catch {
    return { version: 1, data: {} }
  }
}

export async function saveState(payload: PersistedPayload): Promise<boolean> {
  if (hasApi()) return window.api.saveState(payload)
  try {
    if (typeof localStorage !== 'undefined')
      localStorage.setItem(LS_KEY, JSON.stringify(payload))
  } catch {
    /* ignore */
  }
  return true
}

export async function clearState(): Promise<boolean> {
  if (hasApi()) return window.api.clearState()
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(LS_KEY)
  } catch {
    /* ignore */
  }
  return true
}
