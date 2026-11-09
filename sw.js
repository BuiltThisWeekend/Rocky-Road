const CACHE_NAME = 'vanguard-pwa-v1.5.0';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './Truck_Model.png',
  './boulder.png',
  './pickup.png',
  './css/hud.css',
  './src/main.js',
  './src/config/sensors.config.js',
  './src/config/levels.config.js',
  './src/config/equipment.config.js',
  './src/config/rewards.config.js',
  './src/core/loop.js',
  './src/core/input.js',
  './src/core/state.js',
  './src/core/saveManager.js',
  './src/systems/perceptionSystem.js',
  './src/systems/spawnerSystem.js',
  './src/systems/collisionSystem.js',
  './src/systems/audioSystem.js',
  './src/render/canvasRenderer.js',
  './src/render/sensorLayers.js',
  './src/render/hudRenderer.js',
  './src/render/modelRegistry.js',
  './src/render/rigPreviewRenderer.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return null;
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return networkResponse;
      });
    })
  );
});
