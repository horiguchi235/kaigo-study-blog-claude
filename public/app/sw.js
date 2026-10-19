/* 過去問演習 Service Worker
 * 画面（HTML/CSS/JS/アイコン）を保存して、電波がなくても開けるようにする。
 * 問題データ（data/*.json）は app.js が Cache Storage（kaigo-data-v1）に保存するので、ここでは扱わない。
 * ★アプリのファイルを直したら、下の VERSION を上げてください（利用者に「新しいバージョンがあります」が出ます）。
 */
const VERSION = '3.5.5';
const FIG_CACHE = 'kaigo-fig-v1';
const SHELL_CACHE = 'kaigo-shell-' + VERSION;
const SHELL = ['./', 'index.html', 'app.css', 'core.js', 'app.js', 'config.js', 'manifest.webmanifest',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))));
});
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // 古い画面のキャッシュだけ消す（問題データ kaigo-data-v1 は消さない）
    for (const key of await caches.keys()) if (key.startsWith('kaigo-shell-') && key !== SHELL_CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('message', (event) => { if (event.data === 'skipWaiting') self.skipWaiting(); });
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;                       // 外部（計測など）はそのまま
  if (!url.pathname.includes('/app/')) return;                      // ブログのページは扱わない
  if (url.pathname.includes('/__kaigo-data/') || url.pathname.includes('/app/data/')) return; // 問題データはアプリが管理
  if (req.mode === 'navigate') {                                    // 画面：保存した index.html（クエリ付きのリンクも）
    event.respondWith(caches.open(SHELL_CACHE).then((c) => c.match('index.html')).then((r) => r || fetch(req)));
    return;
  }
  if (url.pathname.includes('/app/figures/')) {                     // 図：一度見たら保存（ファイル名が変わらない限り同じ）
    event.respondWith(caches.open(FIG_CACHE).then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; }))));
    return;
  }
  if (url.pathname.endsWith('/config.js') || url.pathname.endsWith('/links.json') || url.pathname.endsWith('/mocks.json')) { // 設定・記事リンク：通信を優先
    event.respondWith(fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(SHELL_CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true })));
    return;
  }
  event.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req)));
});
