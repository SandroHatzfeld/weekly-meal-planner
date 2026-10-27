// Service Worker: App installierbar und Einkaufsliste/Woche/Rezepte offline lesbar.
// - statische Dateien (/_next/static, hashed): Cache zuerst
// - Seiten (Navigation): Netz zuerst, bei Ausfall oder Funkloch die zuletzt gesehene Fassung
// - Bilder: aus dem Cache, im Hintergrund aktualisiert
// Alles andere (Server Actions, API, Socket.io) geht direkt ans Netz.
const VERSION = "v2"
const STATIC = `wmp-static-${VERSION}`
const PAGES = `wmp-pages-${VERSION}`
const IMAGES = `wmp-images-${VERSION}`
const OFFLINE_URL = "/offline.html"
// nach so langer Wartezeit gilt eine vorhandene Fassung aus dem Cache als besser als weiter warten (schwaches Netz im Laden)
const NETWORK_TIMEOUT_MS = 4000
// diese Seiten werden nicht zwischengespeichert (Anmeldung, einmalige Links)
const UNCACHED_PAGES = ["/login", "/register", "/verify", "/invite", "/onboarding"]

self.addEventListener("install", (event) => {
	// Löschen beim Verlassen der Seite (sendBeacon) direkt ans Netz, nicht über diesen Worker:
	// sonst verwirft Chrome die Nachricht, wenn die Seite geschlossen wird
	if (event.addRoutes) {
		event.addRoutes([{ condition: { urlPattern: new URLPattern({ pathname: "/api/grocery-items/*" }) }, source: "network" }]).catch(() => {})
	}
	event.waitUntil(caches.open(STATIC).then((cache) => cache.addAll([OFFLINE_URL, "/icons/icon-192.png"])).then(() => self.skipWaiting()))
})

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((key) => ![STATIC, PAGES, IMAGES].includes(key)).map((key) => caches.delete(key))))
			.then(() => self.clients.claim()),
	)
})

const cacheablePage = (url) => !UNCACHED_PAGES.some((path) => url.pathname === path || url.pathname.startsWith(`${path}/`))

// ein Redirect (z.B. / -> /week, Login-Umleitung) darf nicht unter der Ursprungs-URL liegen
const storePage = async (request, response) => {
	if (!response.ok || response.redirected) return
	const cache = await caches.open(PAGES)
	await cache.put(request, response)
}

const cachedPage = async (request) => (await caches.match(request, { cacheName: PAGES })) ?? (await caches.match(request, { cacheName: PAGES, ignoreSearch: true }))

const handleNavigation = async (event) => {
	const request = event.request
	const url = new URL(request.url)
	const store = cacheablePage(url)
	const network = fetch(request).then((response) => {
		if (store) event.waitUntil(storePage(request, response.clone()))
		return response
	})
	network.catch(() => {}) // wird ggf. nur im Hintergrund abgewartet
	// ohne Netz: Fassung aus dem Cache, sonst die Offline-Seite
	const fallback = async () => (store && (await cachedPage(request))) || (await caches.match(OFFLINE_URL))
	try {
		const cached = store ? await cachedPage(request) : null
		if (!cached) return await network
		// vorhanden: bei langsamem Netz nicht ewig warten
		const timeout = new Promise((resolve) => setTimeout(() => resolve(cached), NETWORK_TIMEOUT_MS))
		return await Promise.race([network, timeout])
	} catch {
		return (await fallback()) ?? Response.error()
	}
}

const cacheFirst = async (request, cacheName) => {
	const cached = await caches.match(request, { cacheName })
	if (cached) return cached
	const response = await fetch(request)
	if (response.ok) (await caches.open(cacheName)).put(request, response.clone())
	return response
}

// Bilder: sofort aus dem Cache, Aktualisierung im Hintergrund
const staleWhileRevalidate = async (event, cacheName) => {
	const cache = await caches.open(cacheName)
	const cached = await cache.match(event.request)
	const refresh = fetch(event.request)
		.then((response) => {
			if (response.ok) cache.put(event.request, response.clone())
			return response
		})
		.catch(() => null)
	if (cached) {
		event.waitUntil(refresh)
		return cached
	}
	return (await refresh) ?? Response.error()
}

self.addEventListener("fetch", (event) => {
	const { request } = event
	if (request.method !== "GET") return
	const url = new URL(request.url)
	if (url.origin !== self.location.origin) return
	if (request.mode === "navigate") return event.respondWith(handleNavigation(event))
	if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) return event.respondWith(cacheFirst(request, STATIC))
	if (url.pathname.startsWith("/api/images/")) return event.respondWith(staleWhileRevalidate(event, IMAGES))
})

self.addEventListener("message", (event) => {
	const data = event.data
	if (data?.type === "clear") {
		// Abmeldung: keine Daten des Nutzers auf dem Gerät lassen
		event.waitUntil(Promise.all([caches.delete(PAGES), caches.delete(IMAGES)]))
	}
	if (data?.type === "warm" && Array.isArray(data.urls)) {
		// Hauptseiten im Hintergrund holen, damit sie auch ohne vorherigen Besuch offline da sind
		event.waitUntil(
			Promise.all(
				data.urls.map(async (path) => {
					try {
						const request = new Request(path, { credentials: "same-origin" })
						const response = await fetch(request)
						await storePage(request, response)
					} catch {}
				}),
			),
		)
	}
})
