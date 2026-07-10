// Service worker mínimo para instalabilidade do PWA (sempre ativo — não tem
// flag, é infraestrutura). Deliberadamente conservador: só cacheia os
// arquivos estáticos versionados do build (JS/CSS em /assets/, cujo nome já
// muda a cada deploy por causa do hash do Vite), em stale-while-revalidate.
// NUNCA intercepta navegação de página, chamadas de API ou Firestore — o
// app sempre busca dados/HTML da rede, evitando qualquer risco de servir
// conteúdo ou lógica desatualizada.

const CACHE_NAME = 'caocipp-static-v1';
const STATIC_CACHE_REGEX = /\/assets\//;

self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;
    if (!STATIC_CACHE_REGEX.test(url.pathname)) return;

    event.respondWith(
        caches.open(CACHE_NAME).then((cache) => cache.match(request).then((cached) => {
            const networkFetch = fetch(request)
                .then((response) => {
                    if (response && response.ok) cache.put(request, response.clone());
                    return response;
                })
                .catch(() => cached);
            return cached || networkFetch;
        }))
    );
});
