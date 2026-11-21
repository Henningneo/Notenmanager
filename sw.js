/* Service Worker des Notenmanagers: App offline startbar machen.
   - Die Seite selbst (index.html) kommt immer zuerst aus dem Netz, damit Updates sofort ankommen.
     Nur ohne Verbindung wird die zuletzt geladene Fassung aus dem Cache genommen.
   - Symbole, Manifest, Schriften und die Firebase-Bibliotheken (feste Versionsnummer) werden zwischengespeichert.
   - Anfragen an Firebase selbst (Datenbank, Anmeldung) laufen nie über diesen Service Worker. */
const VERSION = "nm-v22";
const CACHE = VERSION;
const CORE = [
  "./",
  "./manifest.webmanifest",
  "./icons/favicon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-192.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./fonts/fonts.css"
];
const FB = "https://www.gstatic.com/firebasejs/12.19.0/";
const OPTIONAL = [FB + "firebase-app.js", FB + "firebase-firestore.js", FB + "firebase-auth.js"];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(CORE.map(u => new Request(u, { cache: "reload" })));
    await Promise.allSettled(OPTIONAL.map(u => c.add(new Request(u, { mode: "cors" }))));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if (/^nm-v\d+$/.test(k) && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

function isStaticExternal(url) {
  return url.origin === "https://fonts.googleapis.com" ||
         url.origin === "https://fonts.gstatic.com" ||
         (url.origin === "https://www.gstatic.com" && url.pathname.startsWith("/firebasejs/"));
}

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const scope = new URL(self.registration.scope);
  // Die Beta unter /beta/ hat ihren eigenen Service Worker
  if (sameOrigin && url.pathname.startsWith(scope.pathname + "beta/")) return;

  // Seite: Netz zuerst (ohne alten HTTP-Cache), sonst gespeicherte Fassung
  if (req.mode === "navigate" && sameOrigin && url.pathname.startsWith(scope.pathname)) {
    event.respondWith(networkFirst(req));
    return;
  }
  if (sameOrigin && url.pathname.startsWith(scope.pathname)) {
    if (url.pathname.endsWith("/sw.js")) return;
    event.respondWith(staleWhileRevalidate(req));
    return;
  }
  if (isStaticExternal(url)) {
    // Feste Versionen bzw. unveränderliche Schriftdateien: Cache zuerst
    event.respondWith(cacheFirst(req));
    return;
  }
  // Alles andere (u. a. Firestore, Firebase Auth) bleibt unberührt
});

async function networkFirst(req) {
  const c = await caches.open(CACHE);
  try {
    const res = await withTimeout(fetch(req, { cache: "no-cache" }), 6000);
    if (res && res.ok) { c.put("./", res.clone()); return res; }
    if (res) return res;
  } catch (e) {}
  return (await c.match("./")) || (await c.match(req, { ignoreSearch: true })) ||
    new Response("<!doctype html><meta charset=utf-8><title>Notenmanager</title><p style='font-family:sans-serif;padding:24px'>Keine Verbindung. Öffne den Notenmanager einmal mit Internet, danach startet er auch offline.</p>", { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

async function staleWhileRevalidate(req) {
  const c = await caches.open(CACHE);
  const hit = await c.match(req, { ignoreSearch: true });
  const net = fetch(req).then(res => { if (res && res.ok) c.put(req, res.clone()); return res; }).catch(() => null);
  return hit || (await net) || Response.error();
}

async function cacheFirst(req) {
  const c = await caches.open(CACHE);
  const hit = await c.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && (res.ok || res.type === "opaque")) c.put(req, res.clone());
  return res;
}

function withTimeout(p, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}
