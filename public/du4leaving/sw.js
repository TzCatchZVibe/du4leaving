// DU4LEAVING · service worker · 离线 fallback + 缓存策略
const VERSION = "du4-v1";
const SHELL = ["/xiapan", "/xiapan/overlay", "/du4leaving/manifest.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(VERSION).then((c) => c.addAll(SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
      )
  );
  self.clients.claim();
});

// 网络优先 (live data) + 离线回退 cache
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // 仅缓存 /xiapan 路径 + 静态资源
  if (!url.pathname.startsWith("/xiapan") && !url.pathname.startsWith("/du4leaving")) {
    return;
  }
  // API 永远走网络 (实时报价 · 不缓存)
  if (url.pathname.startsWith("/api/")) {
    return;
  }
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res && res.ok && e.request.method === "GET") {
          const clone = res.clone();
          caches.open(VERSION).then((c) => c.put(e.request, clone)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || new Response("offline", { status: 503 })))
  );
});
