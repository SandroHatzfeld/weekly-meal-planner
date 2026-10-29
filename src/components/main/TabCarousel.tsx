"use client"

import { rememberTabUrl, showTab, type Tab } from "@/lib/tabs"
import { usePathname, useSearchParams } from "next/navigation"
import { useEffect, useRef, type ReactNode } from "react"

const LOCK_PX = 8 // ab hier steht fest, ob die Geste waagerecht oder senkrecht ist
const COMMIT_RATIO = 0.3 // Anteil der Breite, ab dem losgelassen gewechselt wird
const FLICK_PX_PER_MS = 0.4 // schnelles Wischen reicht auch bei kurzer Strecke
const EDGE_RESISTANCE = 0.25 // am ersten/letzten Tab lässt sich nur zäh ziehen
const SNAP = "transform 150ms ease-out"

// nicht wischen, wenn der Finger in etwas startet, das selbst Eingaben oder waagerechtes Scrollen braucht
const blocksSwipe = (target: EventTarget | null) => {
	if (!(target instanceof Element)) return true
	if (target.closest("input, textarea, select, [data-no-swipe]")) return true
	for (let element: Element | null = target; element && !element.hasAttribute("data-tab-panel"); element = element.parentElement) {
		const overflowX = getComputedStyle(element).overflowX
		if ((overflowX === "auto" || overflowX === "scroll") && element.scrollWidth > element.clientWidth) return true
	}
	return false
}

// Karussell einer Tab-Gruppe (Haupt-Tabs, Einstellungen): alle Seiten liegen nebeneinander, der Finger zieht den
// Streifen 1:1 mit, beim Loslassen rastet er auf einen Tab ein. Jeder Tab scrollt für sich (eigene Scrollposition).
export default function TabCarousel({ tabs, panels }: { tabs: readonly Tab[]; panels: ReactNode[] }) {
	const pathname = usePathname()
	const searchParams = useSearchParams()
	const paths = tabs.map((tab) => tab.href)
	const active = Math.max(0, paths.indexOf(pathname))
	const viewport = useRef<HTMLDivElement>(null)
	const strip = useRef<HTMLDivElement>(null)
	// aktuell angezeigter Tab (kann während der Geste vom Pfad abweichen)
	const shown = useRef(active)

	// Adresse des aktiven Tabs merken (z.B. gewählte Liste, Monat, Filter)
	useEffect(() => {
		const query = searchParams.toString()
		rememberTabUrl(pathname, query ? `${pathname}?${query}` : pathname)
	}, [pathname, searchParams])

	const place = (index: number, offset: number, animate: boolean) => {
		const element = strip.current
		if (!element) return
		element.style.transition = animate ? SNAP : "none"
		element.style.transform = `translate3d(calc(${-index * 100}% + ${offset}px), 0, 0)`
	}

	// Tab-Klick, Zurück-Taste oder Wischen: zum Tab der Adresse gleiten
	useEffect(() => {
		// nach dem Wischen ist die Animation schon unterwegs: nicht noch einmal (ohne Übergang) setzen
		if (shown.current === active) return
		shown.current = active
		place(active, 0, true)
	}, [active])

	useEffect(() => {
		const element = viewport.current
		if (!element) return
		let start: { x: number; y: number } | null = null
		let mode: "undecided" | "horizontal" | "vertical" = "undecided"
		let dx = 0
		// letzte Bewegungen für die Geschwindigkeit beim Loslassen
		let samples: { x: number; t: number }[] = []

		const onStart = (event: TouchEvent) => {
			start = null
			mode = "undecided"
			dx = 0
			samples = []
			if (event.touches.length !== 1 || blocksSwipe(event.target)) return
			start = { x: event.touches[0].clientX, y: event.touches[0].clientY }
		}
		const onMove = (event: TouchEvent) => {
			if (!start || mode === "vertical") return
			const touch = event.touches[0]
			const moveX = touch.clientX - start.x
			const moveY = touch.clientY - start.y
			if (mode === "undecided") {
				if (Math.max(Math.abs(moveX), Math.abs(moveY)) < LOCK_PX) return
				mode = Math.abs(moveX) > Math.abs(moveY) ? "horizontal" : "vertical"
				if (mode === "vertical") return
				// ab hier zählt die Bewegung ohne die Anlaufstrecke, damit der Inhalt nicht springt
				start = { x: touch.clientX, y: touch.clientY }
				samples = [{ x: touch.clientX, t: performance.now() }]
			}
			if (event.cancelable) event.preventDefault()
			const raw = touch.clientX - start.x
			const index = shown.current
			const outward = (raw > 0 && index === 0) || (raw < 0 && index === paths.length - 1)
			dx = outward ? raw * EDGE_RESISTANCE : raw
			// Geschwindigkeit über die letzten ~100 ms
			const now = performance.now()
			samples = [...samples.filter((sample) => now - sample.t < 100), { x: touch.clientX, t: now }]
			place(index, dx, false)
		}
		const onEnd = (event: TouchEvent) => {
			if (!start || mode !== "horizontal") return
			// Endpunkt mitnehmen (bei schnellen Wischern kommen nur wenige Bewegungs-Ereignisse an)
			const touch = event.changedTouches[0]
			if (touch) samples.push({ x: touch.clientX, t: performance.now() })
			start = null
			mode = "undecided"
			const width = element.clientWidth
			const first = samples[0]
			const last = samples[samples.length - 1]
			const velocity = first && last && last.t > first.t ? (last.x - first.x) / (last.t - first.t) : 0
			const index = shown.current
			let target = index
			if (dx < -width * COMMIT_RATIO || velocity < -FLICK_PX_PER_MS) target = index + 1
			if (dx > width * COMMIT_RATIO || velocity > FLICK_PX_PER_MS) target = index - 1
			target = Math.min(Math.max(target, 0), paths.length - 1)
			shown.current = target
			place(target, 0, true)
			if (target !== index) showTab(paths[target])
		}

		element.addEventListener("touchstart", onStart, { passive: true })
		element.addEventListener("touchmove", onMove, { passive: false })
		element.addEventListener("touchend", onEnd, { passive: true })
		element.addEventListener("touchcancel", onEnd, { passive: true })
		return () => {
			element.removeEventListener("touchstart", onStart)
			element.removeEventListener("touchmove", onMove)
			element.removeEventListener("touchend", onEnd)
			element.removeEventListener("touchcancel", onEnd)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- Pfade einer Gruppe ändern sich nicht
	}, [])

	return (
		// volle Höhe unter der Kopfzeile; die Ränder von <main> werden hier aufgehoben, jeder Tab hat seinen eigenen
		<div ref={viewport} className="-m-4 h-[calc(100dvh-var(--app-header-h,0px))] touch-pan-y overflow-hidden overscroll-x-none">
			<div ref={strip} className="flex h-full will-change-transform" style={{ transform: `translate3d(calc(${-active * 100}% + 0px), 0, 0)` }}>
				{panels.map((panel, index) => (
					<section
						key={paths[index]}
						data-tab-panel
						// nur der sichtbare Tab ist bedienbar (Tastatur, Screenreader)
						inert={index !== active}
						aria-label={tabs[index].name}
						className="h-full w-full shrink-0 overflow-y-auto overscroll-y-contain p-4"
					>
						{panel}
					</section>
				))}
			</div>
		</div>
	)
}
