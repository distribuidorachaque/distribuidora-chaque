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
  event.respondWith(fetch(event.request));
});
