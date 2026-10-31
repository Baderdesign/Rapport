/* Service Worker: macht die App installierbar und startet sie auch ohne Netz. Liegt im selben Ordner wie index.html. */
var CACHE = "wochenrapport-v3-201";
var CORE = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png"];
var LIBS = [
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js"
];
self.addEventListener("install", function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(CORE.map(function (u) { return c.add(new Request(u, { cache: "reload" })).catch(function () { }); })
      .concat(LIBS.map(function (u) { return fetch(u).then(function (r) { if (r && r.ok) return c.put(u, r); }).catch(function () { }); })));
  }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
function tmo(p, ms) { return new Promise(function (res, rej) { var t = setTimeout(function () { rej(new Error("timeout")); }, ms); p.then(function (r) { clearTimeout(t); res(r); }, function (e) { clearTimeout(t); rej(e); }); }); }
self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin === self.location.origin) {
    /* eigene Dateien: sofort die gespeicherte Kopie zeigen (kein weisser Bildschirm bei schwachem Netz) und im Hintergrund die neueste Version holen */
    e.respondWith(caches.match(req, { ignoreSearch: true }).then(function (m) {
      var upd = fetch(new Request(req.url, { cache: "reload" })).then(function (r) {
        if (r && r.ok) { var copy = r.clone(); e.waitUntil(caches.open(CACHE).then(function (c) { return c.put(req, copy); }).catch(function () { })); }
        return r;
      });
      if (m) { e.waitUntil(upd.catch(function () { })); return m; }
      return upd.catch(function () { return req.mode === "navigate" ? caches.match("index.html") : undefined; });
    }));
  } else if (LIBS.indexOf(req.url) >= 0 || /^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(req.url)) {
    /* PDF-, Cloud-Bibliothek und Schriften: zuerst gespeicherte Kopie; ohne Kopie max. 3 s warten, damit die App nie haengt */
    e.respondWith(caches.match(req).then(function (m) {
      return m || tmo(fetch(req), 3000).then(function (r) { if (r && r.ok) { var copy = r.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); } return r; }).catch(function () { return new Response("", { status: 504 }); });
    }));
  }
});
