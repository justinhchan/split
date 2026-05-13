import './assets/index.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { useAppStore } from './store/useAppStore'

// Kick off hydration as soon as the module loads. The store starts with
// INITIAL_STATE so the first render is safe even before IPC resolves.
void useAppStore.getState().hydrate()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
