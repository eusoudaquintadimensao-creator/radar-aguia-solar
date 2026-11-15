// Service worker: app funciona offline com os últimos dados salvos.
const VERSAO = 'ras-v1';
const NUCLEO = ['./', 'index.html', 'css/app.css', 'js/app.js', 'js/util.js', 'js/engine.js', 'js/sim.js', 'js/extras.js', 'js/graf.js', 'js/catalogo.js', 'js/sentiment.js', 'vendor/purify.es.mjs', 'vendor/fuse.min.mjs', 'vendor/lightweight-charts.mjs', 'manifest.webmanifest', 'img/hero.webp', 'img/hero-m.webp', 'img/logo-96.webp', 'icons/icon-192.png', 'icons/favicon-64.png', 'data/nvidia.json', 'data/news.json', 'data/markets.json', 'data/status.json', 'data/reguladas.json', 'data/history.json'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSAO).then(c => c.addAll(NUCLEO)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // APIs externas: o app tem cache próprio
  const dados = u.pathname.includes('/data/');
  if (dados || e.request.mode === 'navigate' || /\.(js|css|html)$/.test(u.pathname)) {
    // rede primeiro (dados frescos), cache se offline
    e.respondWith(fetch(e.request).then(r => { if (r.ok) { const cp = r.clone(); caches.open(VERSAO).then(c => c.put(dados ? new Request(u.pathname) : e.request, cp)); } return r; })
      .catch(() => caches.match(dados ? new Request(u.pathname) : e.request).then(r => r || caches.match('index.html'))));
  } else {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => { if (res.ok) { const cp = res.clone(); caches.open(VERSAO).then(c => c.put(e.request, cp)); } return res; })));
  }
});
