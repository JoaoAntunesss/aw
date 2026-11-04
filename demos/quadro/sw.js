/* Service worker do template Quadro.
   Muda VERSAO sempre que publicares alterações, para os telemóveis receberem a versão nova. */
const VERSAO = "quadro-v1";
const ESSENCIAIS = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(ESSENCIAIS)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  // Só guarda ficheiros do próprio site. Firebase, Zoom, Teams e pagamentos vão sempre à rede.
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/__/")) return;

  // Páginas: tenta a rede primeiro (para estar sempre atualizado) e usa a cópia guardada sem internet.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then(r => { const c = r.clone(); caches.open(VERSAO).then(x => x.put("./index.html", c)); return r; })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Ícones, imagens e outros ficheiros: usa a cópia guardada, se existir.
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(r => {
      if (r.ok) { const c = r.clone(); caches.open(VERSAO).then(x => x.put(req, c)); }
      return r;
    }))
  );
});
