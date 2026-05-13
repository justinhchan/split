import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

export interface PersistedPayload {
  version: 1
  data: Record<string, unknown>
}

const api = {
  loadState: (): Promise<PersistedPayload> => ipcRenderer.invoke('state:load'),
  saveState: (payload: PersistedPayload): Promise<boolean> =>
    ipcRenderer.invoke('state:save', payload),
  clearState: (): Promise<boolean> => ipcRenderer.invoke('state:clear')
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}

export type Api = typeof api
