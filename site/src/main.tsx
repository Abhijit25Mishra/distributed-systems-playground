import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './app'

// Self-hosted. No CDN link, no third-party request, no layout shift from a
// font that arrives after first paint.
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'

import './styles/tokens.css'
import './styles/base.css'
import './styles/layout.css'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('root element not found')
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
