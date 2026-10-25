"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"

// Reihenfolge der Haupt-Tabs (wie in der Kopfzeile); Wischen nach links = nächster Tab, nach rechts = vorheriger
const TAB_ROUTES = ["/shop", "/week", "/month", "/recipes"]
const MIN_DISTANCE_PX = 70
const MAX_DURATION_MS = 700

// nicht wischen, wenn der Finger in etwas startet, das selbst horizontal reagiert oder Eingaben braucht
const blocksSwipe = (target: EventTarget | null) => {
	if (!(target instanceof Element)) return true
	if (target.closest("input, textarea, select, dialog, [data-no-swipe]")) return true
	if (document.querySelector("dialog[open]")) return true
	for (let element: Element | null = target; element && element !== document.body; element = element.parentElement) {
		const overflowX = getComputedStyle(element).overflowX
		if ((overflowX === "auto" || overflowX === "scroll") && element.scrollWidth > element.clientWidth) return true
	}
	return false
}

export default function SwipeTabs() {
	const router = useRouter()
	const pathname = usePathname()

	useEffect(() => {
		// nur auf den Hauptseiten der Tabs, nicht auf Rezept- oder Gericht-Details
		const index = TAB_ROUTES.indexOf(pathname)
		if (index < 0) return
		let start: { x: number; y: number; at: number } | null = null

		const onStart = (event: TouchEvent) => {
			start = event.touches.length === 1 && !blocksSwipe(event.target) ? { x: event.touches[0].clientX, y: event.touches[0].clientY, at: Date.now() } : null
		}
		const onEnd = (event: TouchEvent) => {
			if (!start) return
			const touch = event.changedTouches[0]
			const dx = touch.clientX - start.x
			const dy = touch.clientY - start.y
			const quick = Date.now() - start.at <= MAX_DURATION_MS
			start = null
			// deutlich waagerecht, nicht beim Scrollen oder Markieren von Text
			if (!quick || Math.abs(dx) < MIN_DISTANCE_PX || Math.abs(dx) < Math.abs(dy) * 2 || window.getSelection()?.toString()) return
			const next = TAB_ROUTES[index + (dx < 0 ? 1 : -1)]
			if (next) router.push(next)
		}
		const cancel = () => (start = null)

		document.addEventListener("touchstart", onStart, { passive: true })
		document.addEventListener("touchend", onEnd, { passive: true })
		document.addEventListener("touchcancel", cancel, { passive: true })
		return () => {
			document.removeEventListener("touchstart", onStart)
			document.removeEventListener("touchend", onEnd)
			document.removeEventListener("touchcancel", cancel)
		}
	}, [pathname, router])

	return null
}
