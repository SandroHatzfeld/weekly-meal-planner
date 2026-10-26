"use client"

import { clearPendingToggles, flushToggles } from "@/lib/offline/toggles"
import { usePathname } from "next/navigation"
import { useEffect } from "react"

// Seiten, die nach dem Start im Hintergrund für die Offline-Nutzung geholt werden
const WARM_PAGES = ["/shop", "/week", "/month", "/recipes"]
const WARM_KEY = "wmp-warmed-at"
const WARM_INTERVAL_MS = 10 * 60 * 1000

const sendToWorker = async (message: unknown) => {
	const registration = await navigator.serviceWorker.ready
	registration.active?.postMessage(message)
}

// Service Worker anmelden, Offline-Cache vorwärmen und gemerkte Änderungen senden, sobald wieder Netz da ist
export default function PwaSetup() {
	const pathname = usePathname()

	useEffect(() => {
		if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return
		navigator.serviceWorker.register("/sw.js").catch(() => {})
	}, [])

	useEffect(() => {
		if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return
		if (pathname === "/login") {
			// nach dem Abmelden keine Daten des Nutzers auf dem Gerät lassen
			sendToWorker({ type: "clear" }).catch(() => {})
			clearPendingToggles()
			try {
				localStorage.removeItem(WARM_KEY)
			} catch {}
			return
		}
		if (pathname === "/register" || pathname === "/verify" || pathname === "/invite" || pathname.startsWith("/onboarding")) return
		let warmedAt = 0
		try {
			warmedAt = Number(localStorage.getItem(WARM_KEY) ?? 0)
		} catch {}
		if (navigator.onLine && Date.now() - warmedAt > WARM_INTERVAL_MS) {
			sendToWorker({ type: "warm", urls: WARM_PAGES }).catch(() => {})
			try {
				localStorage.setItem(WARM_KEY, String(Date.now()))
			} catch {}
		}
	}, [pathname])

	useEffect(() => {
		const flush = () => void flushToggles()
		if (navigator.onLine) flush()
		window.addEventListener("online", flush)
		return () => window.removeEventListener("online", flush)
	}, [])

	return null
}
