import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initTheme } from './utils/theme.js'
import { installSessionGuard } from './lib/sessionGuard.js'

// Antes de que React monte nada: si no, la pantalla se ve en claro un
// instante y luego "salta" a oscuro cuando React ya cargó.
initTheme()
installSessionGuard()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
