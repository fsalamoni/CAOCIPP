import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import ErrorBoundary from '@/components/ErrorBoundary.jsx'
import '@/index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)

// PWA: registra o service worker só em produção (evita interferir com o
// dev server/HMR do Vite). Instalabilidade — sem flag, é infraestrutura.
// Cache-bust (?v=2) garante que o browser SEMPRE baixa o SW novo mesmo
// quando o servidor não envia `Cache-Control: no-cache` no sw.js.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js?v=2').catch(() => { /* best-effort */ });
  });
}
