const CACHE_NAME = 'workout-tracker-v1';
const ASSETS = [
	'./',
	'./index.html',
	'./style.css',
	'./app.js',
	'./manifest.webmanifest',
	'./icons/logo.svg'
];

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
	);
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((keys) =>
			Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k))))
		)
	);
	self.clients.claim();
});

self.addEventListener('fetch', (event) => {
	const { request } = event;
	// Network first for navigation, cache first for static assets
	if (request.mode === 'navigate') {
		event.respondWith(
			fetch(request).catch(() => caches.match('./index.html'))
		);
		return;
	}
	event.respondWith(
		caches.match(request).then((cached) => cached || fetch(request))
	);
});


