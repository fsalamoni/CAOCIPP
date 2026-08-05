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
// Cache-bust (?v=4) garante que o browser SEMPRE baixa o SW novo mesmo
// quando o servidor não envia `Cache-Control: no-cache` no sw.js. O
// cleanup agressivo de caches legados (v1/v2/v3) garante que mesmo
// navegadores com sessão longa aberta (que não capturaram o activate dos
// SWs anteriores) consigam ver o bundle novo sem hard refresh manual.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    if (typeof caches !== 'undefined') {
      caches.keys().then((keys) => {
        keys.forEach((k) => {
          // Apaga QUALQUER cache que não seja do SW atual (v4).
          if (k !== 'caocipp-static-v4') {
            caches.delete(k).catch(() => {});
          }
        });
      });
    }
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => {
        // Se o SW registrado tem URL com versão antiga, desregistra.
        if (reg.active && !reg.active.scriptURL.includes('v=4')) {
          reg.unregister().catch(() => {});
        }
      });
    });
    navigator.serviceWorker.register('/sw.js?v=4').catch(() => { /* best-effort */ });
  });
}
