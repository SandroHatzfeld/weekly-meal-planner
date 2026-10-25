"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react"

// Reihenfolge der Haupt-Tabs (wie in der Kopfzeile); Wischen nach links = nächster Tab, nach rechts = vorheriger.
// Der Inhalt folgt dem Finger; losgelassen gleitet er hinaus und die neue Seite von der anderen Seite herein.
const TAB_ROUTES = ["/shop", "/week", "/month", "/recipes"]
const LOCK_PX = 10 // ab hier steht fest, ob die Geste waagerecht oder senkrecht ist
const COMMIT_RATIO = 0.25 // Anteil der Breite, ab dem losgelassen gewechselt wird
const FLICK_PX_PER_MS = 0.5 // schnelles Wischen reicht auch bei kurzer Strecke
const EDGE_RESISTANCE = 0.3 // am ersten/letzten Tab lässt sich der Inhalt nur zäh ziehen
const MS = 200

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

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches

export default function SwipeTabs({ children }: { children: ReactNode }) {
	const router = useRouter()
	const pathname = usePathname()
	const content = useRef<HTMLDivElement>(null)
	// Richtung der letzten Wischgeste (-1: Inhalt ging nach links hinaus), damit die neue Seite von der Gegenseite hereinkommt
	const entering = useRef(0)

	// aus dem Client-Cache gezeigte Seite im Hintergrund auf den neuesten Stand bringen (nicht beim ersten Laden)
	const firstPath = useRef(pathname)
	useEffect(() => {
		if (firstPath.current === pathname) return
		firstPath.current = pathname
		if (TAB_ROUTES.includes(pathname) && navigator.onLine) router.refresh()
	}, [pathname, router])

	// neue Seite gleitet herein
	useLayoutEffect(() => {
		const element = content.current
		const direction = entering.current
		entering.current = 0
		if (!element || !direction) return
		element.style.transition = "none"
		element.style.transform = `translateX(${-direction * 100}%)`
		element.getBoundingClientRect() // Startposition festschreiben
		element.style.transition = `transform ${MS}ms ease-out`
		element.style.transform = "translateX(0)"
		const done = setTimeout(() => {
			// kein Transform im Ruhezustand, sonst bricht er sticky/fixed-Elemente der Seiten
			element.style.transition = ""
			element.style.transform = ""
		}, MS)
		return () => clearTimeout(done)
	}, [pathname])

	useEffect(() => {
		// nur auf den Hauptseiten der Tabs, nicht auf Rezept- oder Gericht-Details
		const index = TAB_ROUTES.indexOf(pathname)
		const element = content.current
		if (index < 0 || !element) return
		let start: { x: number; y: number; at: number } | null = null
		let mode: "undecided" | "horizontal" | "vertical" = "undecided"
		let dx = 0

		const place = (offset: number, animate: boolean) => {
			element.style.transition = animate ? `transform ${MS}ms ease-out` : "none"
			element.style.transform = offset ? `translateX(${offset}px)` : ""
		}
		const reset = () => {
			start = null
			mode = "undecided"
			dx = 0
		}

		const onStart = (event: TouchEvent) => {
			reset()
			if (event.touches.length === 1 && !blocksSwipe(event.target)) start = { x: event.touches[0].clientX, y: event.touches[0].clientY, at: Date.now() }
		}
		const onMove = (event: TouchEvent) => {
			if (!start || mode === "vertical") return
			const touch = event.touches[0]
			dx = touch.clientX - start.x
			const dy = touch.clientY - start.y
			if (mode === "undecided") {
				if (Math.max(Math.abs(dx), Math.abs(dy)) < LOCK_PX) return
				mode = Math.abs(dx) > Math.abs(dy) * 1.5 && !window.getSelection()?.toString() ? "horizontal" : "vertical"
				if (mode === "vertical") return
			}
			event.preventDefault() // beim waagerechten Ziehen nicht gleichzeitig senkrecht scrollen
			const hasTarget = !!TAB_ROUTES[index + (dx < 0 ? 1 : -1)]
			place(hasTarget ? dx : dx * EDGE_RESISTANCE, false)
		}
		const onEnd = () => {
			const swiped = start && mode === "horizontal"
			const distance = dx
			const elapsed = start ? Date.now() - start.at : 0
			reset()
			if (!swiped) return
			const next = TAB_ROUTES[index + (distance < 0 ? 1 : -1)]
			const committed = Math.abs(distance) > window.innerWidth * COMMIT_RATIO || Math.abs(distance) / Math.max(elapsed, 1) > FLICK_PX_PER_MS
			if (!next || !committed) return place(0, true)
			const direction = distance < 0 ? -1 : 1
			if (reducedMotion()) {
				place(0, false)
				return router.push(next)
			}
			// hinausgleiten, dann wechseln; die neue Seite gleitet in einem Layout-Effekt herein
			entering.current = direction
			place(direction * window.innerWidth, true)
			setTimeout(() => router.push(next), MS)
			// kommt die neue Seite nicht (Fehler), den Inhalt wieder zurückholen
			setTimeout(() => {
				if (entering.current === 0) return
				entering.current = 0
				place(0, true)
			}, 4000)
		}

		document.addEventListener("touchstart", onStart, { passive: true })
		document.addEventListener("touchmove", onMove, { passive: false })
		document.addEventListener("touchend", onEnd, { passive: true })
		document.addEventListener("touchcancel", onEnd, { passive: true })
		return () => {
			document.removeEventListener("touchstart", onStart)
			document.removeEventListener("touchmove", onMove)
			document.removeEventListener("touchend", onEnd)
			document.removeEventListener("touchcancel", onEnd)
		}
	}, [pathname, router])

	return (
		<div className="overflow-x-clip">
			<div ref={content}>{children}</div>
		</div>
	)
}
