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
// Cache-bust (?v=3) garante que o browser SEMPRE baixa o SW novo mesmo
// quando o servidor não envia `Cache-Control: no-cache` no sw.js. Além
// disso, o unregister/cleanup explícito do SW v1 evita que um bundle
// antigo cacheado persista em navegadores que não pegam o activate a tempo.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Limpa caches de SWs antigos (v1) que ainda podem estar ativos em
    // browsers com sessão longa aberta. Não interfere com o registro do
    // SW v3 abaixo: o unregister devolve o controle ao browser.
    if (typeof caches !== 'undefined') {
      caches.keys().then((keys) => {
        keys.forEach((k) => {
          // Apaga QUALQUER cache que não seja do SW atual (v3).
          if (k !== 'caocipp-static-v3') {
            caches.delete(k).catch(() => {});
          }
        });
      });
    }
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => {
        // Se o SW registrado tem URL com versão antiga, desregistra.
        if (reg.active && !reg.active.scriptURL.includes('v=3')) {
          reg.unregister().catch(() => {});
        }
      });
    });
    navigator.serviceWorker.register('/sw.js?v=3').catch(() => { /* best-effort */ });
  });
}
