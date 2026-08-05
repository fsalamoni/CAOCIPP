// Service worker mínimo para instalabilidade do PWA (sempre ativo — não tem
// flag, é infraestrutura). Estratégia: network-first para HTML e para
// bundles em /assets/ (garante deploy novo SEMPRE vence o cache); cache só
// para fallback offline. Bumps no CACHE_NAME invalidam qualquer cache
// residual de versões anteriores.

const CACHE_NAME = 'caocipp-static-v4';
const STATIC_CACHE_REGEX = /\/assets\//;

self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    // Apaga TODOS os caches que não sejam o atual (v4). Garante limpeza
    // agressiva de caches legados de SWs v1/v2/v3 que possam estar prendendo
    // bundles antigos no navegador do usuário.
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys.filter((k) => k !== CACHE_NAME).map((k) => {
                    console.log('[SW v4] Deletando cache legado:', k);
                    return caches.delete(k);
                })
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;
    if (!STATIC_CACHE_REGEX.test(url.pathname)) return;

    // Network-first: tenta a rede; em caso de sucesso, atualiza o cache. Se a
    // rede falhar (offline), usa o cache como fallback. Esta ordem garante
    // que o bundle novo publicado em produção VENCE o cache antigo, sem
    // esperar o ciclo de SW activate.
    event.respondWith(
        fetch(request)
            .then((response) => {
                if (response && response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => {});
                }
                return response;
            })
            .catch(() => caches.open(CACHE_NAME).then((cache) => cache.match(request).then((cached) => cached || Response.error())))
    );
});
