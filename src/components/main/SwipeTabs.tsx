"use client"

import { animate, AnimatePresence, motion, useMotionValue, useIsPresent, useReducedMotion, type MotionValue } from "framer-motion"
import { LayoutRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime"
import { usePathname, useRouter } from "next/navigation"
import { useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react"

// Reihenfolge der Haupt-Tabs (wie in der Kopfzeile); Wischen nach links = nächster Tab, nach rechts = vorheriger.
// Der Inhalt folgt dem Finger; beim Wechsel gleitet die alte Seite hinaus und die neue gleichzeitig herein.
const TAB_ROUTES = ["/shop", "/week", "/month", "/recipes"]
const LOCK_PX = 10 // ab hier steht fest, ob die Geste waagerecht oder senkrecht ist
const COMMIT_RATIO = 0.25 // Anteil der Breite, ab dem losgelassen gewechselt wird
const FLICK_PX_PER_MS = 0.5 // schnelles Wischen reicht auch bei kurzer Strecke
const EDGE_RESISTANCE = 0.3 // am ersten/letzten Tab lässt sich der Inhalt nur zäh ziehen
const DURATION = 0.25

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

// Die hinausgleitende Seite behält den Router-Zustand von vorher; sonst würde sie sofort die neue Route anzeigen.
// Solange eine Seite sichtbar ist, folgt sie dem aktuellen Zustand (Filter, Auffrischen, Socket-Updates).
function FrozenRouter({ children }: { children: ReactNode }) {
	const context = useContext(LayoutRouterContext)
	const isPresent = useIsPresent()
	const [last, setLast] = useState(context)
	if (isPresent && last !== context) setLast(context)
	return <LayoutRouterContext.Provider value={isPresent ? context : last}>{children}</LayoutRouterContext.Provider>
}

type Motion = { dir: number; offset: number; instant: boolean }

const variants = {
	// dir: 1 = vorwärts (alte Seite geht nach links hinaus), -1 = zurück, 0 = kein Tab-Wechsel
	enter: ({ dir, offset }: Motion) => ({ x: dir * window.innerWidth + offset }),
	center: ({ instant }: Motion) => ({ x: 0, transition: { duration: instant ? 0 : DURATION, ease: "easeOut" as const } }),
	exit: ({ dir, instant }: Motion) => ({ x: -dir * window.innerWidth, transition: { duration: instant || !dir ? 0 : DURATION, ease: "easeOut" as const } }),
}

function Page({ children, custom, register }: { children: ReactNode; custom: Motion; register: (x: MotionValue<number>) => void }) {
	const x = useMotionValue(0)
	useEffect(() => register(x), [x, register])
	return (
		<motion.div style={{ x }} variants={variants} custom={custom} initial="enter" animate="center" exit="exit">
			<FrozenRouter>{children}</FrozenRouter>
		</motion.div>
	)
}

export default function SwipeTabs({ children }: { children: ReactNode }) {
	const router = useRouter()
	const pathname = usePathname()
	const reduced = !!useReducedMotion()
	const currentX = useRef<MotionValue<number> | null>(null)
	const register = useCallback((x: MotionValue<number>) => {
		currentX.current = x
	}, [])
	const pathRef = useRef(pathname)
	// Richtung des Wechsels: aus der Position der Tabs; Versatz = wo der Finger die Seite losgelassen hat
	const [released, setReleased] = useState(0)
	const [nav, setNav] = useState({ path: pathname, dir: 0, offset: 0 })
	if (nav.path !== pathname) {
		const from = TAB_ROUTES.indexOf(nav.path)
		const to = TAB_ROUTES.indexOf(pathname)
		setNav({ path: pathname, dir: from >= 0 && to >= 0 ? Math.sign(to - from) : 0, offset: released })
		setReleased(0)
	}
	const motionProps: Motion = { dir: nav.dir, offset: nav.offset, instant: reduced }

	// aus dem Client-Cache gezeigte Seite im Hintergrund auf den neuesten Stand bringen (nicht beim ersten Laden)
	const firstPath = useRef(pathname)
	useEffect(() => {
		pathRef.current = pathname
		if (firstPath.current === pathname) return
		firstPath.current = pathname
		if (TAB_ROUTES.includes(pathname) && navigator.onLine) router.refresh()
	}, [pathname, router])

	useEffect(() => {
		// nur auf den Hauptseiten der Tabs, nicht auf Rezept- oder Gericht-Details
		const index = TAB_ROUTES.indexOf(pathname)
		if (index < 0) return
		let start: { x: number; y: number; at: number } | null = null
		let mode: "undecided" | "horizontal" | "vertical" = "undecided"
		let dx = 0
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
			currentX.current?.set(hasTarget ? dx : dx * EDGE_RESISTANCE)
		}
		const onEnd = () => {
			const swiped = start && mode === "horizontal"
			const distance = dx
			const elapsed = start ? Date.now() - start.at : 0
			reset()
			const x = currentX.current
			if (!swiped || !x) return
			const next = TAB_ROUTES[index + (distance < 0 ? 1 : -1)]
			const committed = Math.abs(distance) > window.innerWidth * COMMIT_RATIO || Math.abs(distance) / Math.max(elapsed, 1) > FLICK_PX_PER_MS
			if (!next || !committed) {
				animate(x, 0, { duration: reduced ? 0 : 0.2, ease: "easeOut" })
				return
			}
			// sofort wechseln: die alte Seite gleitet von der Fingerposition hinaus, die neue gleichzeitig daneben herein
			setReleased(distance)
			router.push(next)
			// kommt die neue Seite nicht (Fehler), den Inhalt wieder zurückholen
			setTimeout(() => {
				if (pathRef.current === pathname) animate(x, 0, { duration: 0.2, ease: "easeOut" })
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
	}, [pathname, router, reduced])

	return (
		<div className="relative overflow-x-clip">
			<AnimatePresence initial={false} mode="popLayout" custom={motionProps}>
				<Page key={pathname} custom={motionProps} register={register}>
					{children}
				</Page>
			</AnimatePresence>
		</div>
	)
}
