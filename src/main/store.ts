import Store from 'electron-store'

/**
 * A single JSON blob written atomically via electron-store. We don't type the
 * schema here because the renderer owns the source-of-truth types (PersistedState
 * in @renderer/store/types). Main just reads/writes the opaque payload.
 */
export interface PersistedPayload {
  version: 1
  data: Record<string, unknown>
}

const DEFAULT_PAYLOAD: PersistedPayload = { version: 1, data: {} }

const store = new Store<PersistedPayload>({
  name: 'split-state',
  defaults: DEFAULT_PAYLOAD,
  clearInvalidConfig: true
})

export function loadState(): PersistedPayload {
  const v = store.get('version')
  const d = store.get('data')
  if (typeof v !== 'number') return DEFAULT_PAYLOAD
  return { version: 1, data: (d as Record<string, unknown>) ?? {} }
}

export function saveState(payload: PersistedPayload): void {
  store.set('version', payload.version)
  store.set('data', payload.data ?? {})
}

export function clearState(): void {
  store.clear()
}
