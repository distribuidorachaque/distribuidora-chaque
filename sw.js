// Service worker mínimo: existe solo para que el navegador reconozca la
// página como una app instalable. A propósito NO guarda nada en caché, así
// siempre te va a mostrar la última versión que subiste a GitHub — sin
// riesgo de que te quede una versión vieja pegada.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // Los archivos de la app (index.html, script.js, style.css, etc.) se piden
  // siempre frescos a GitHub: "no-store" hace que el navegador tampoco use su
  // copia guardada de hasta 10 minutos. Lo de afuera (Google, librerías) va
  // como siempre.
  if (req.method === "GET" && new URL(req.url).origin === self.location.origin) {
    event.respondWith(fetch(req, { cache: "no-store" }));
  } else {
    event.respondWith(fetch(req));
  }
});
