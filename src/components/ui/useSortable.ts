"use client"

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react"

// Sortieren per Griff: Ziehen (Pointer Events, auch Touch) oder Pfeiltasten auf dem fokussierten Griff.
// ids kommen sortiert vom Server; onPersist speichert die neue Reihenfolge.
export const useSortable = (ids: string[], onPersist: (ids: string[]) => void) => {
	const [dragId, setDragId] = useState<string | null>(null)
	const [order, setOrderState] = useState(ids)
	// neuer Stand vom Server (eigene oder fremde Änderung): übernehmen, solange nicht gezogen wird
	const signature = ids.join()
	const [synced, setSynced] = useState(signature)
	if (synced !== signature && !dragId) {
		setSynced(signature)
		setOrderState(ids)
	}
	const rows = useRef(new Map<string, HTMLElement>())
	// Stand für die Fenster-Handler (laufen außerhalb von React-Renders)
	const orderRef = useRef(order)
	const persistRef = useRef(onPersist)
	// auch Änderungen von außen (Zeile hinzugefügt/entfernt, neuer Serverstand) in den Ref übernehmen, sonst arbeitet das nächste
	// Ziehen mit einer veralteten Reihenfolge
	useEffect(() => {
		persistRef.current = onPersist
		orderRef.current = order
	})
	const setOrder = (next: string[]) => {
		orderRef.current = next
		setOrderState(next)
	}

	// Zeile an die Position verschieben, über deren Mitte der Finger gerade ist
	const dragTo = (id: string, clientY: number) => {
		const current = orderRef.current
		const others = current.filter((other) => other !== id)
		let index = others.length
		for (let i = 0; i < others.length; i++) {
			const box = rows.current.get(others[i])?.getBoundingClientRect()
			if (box && clientY < box.top + box.height / 2) {
				index = i
				break
			}
		}
		const next = [...others.slice(0, index), id, ...others.slice(index)]
		if (next.join() !== current.join()) setOrder(next)
	}

	// Bewegung und Loslassen am Fenster verfolgen statt per Pointer Capture am Griff: Wandert die Zeile beim Umsortieren
	// im DOM, geht die Zeigerbindung verloren – das darf das Ziehen weder beenden noch hängen lassen (auch bei schnellen Zügen).
	const startDrag = (id: string, pointerId: number) => {
		orderRef.current = order
		setDragId(id)
		const onMove = (event: globalThis.PointerEvent) => {
			if (event.pointerId === pointerId) dragTo(id, event.clientY)
		}
		const end = (event: globalThis.PointerEvent) => {
			if (event.pointerId !== pointerId) return
			window.removeEventListener("pointermove", onMove)
			window.removeEventListener("pointerup", end)
			window.removeEventListener("pointercancel", end)
			setDragId(null)
			persistRef.current(orderRef.current)
		}
		window.addEventListener("pointermove", onMove)
		window.addEventListener("pointerup", end)
		window.addEventListener("pointercancel", end)
	}

	const move = (id: string, delta: number) => {
		const index = order.indexOf(id)
		const target = index + delta
		if (index < 0 || target < 0 || target >= order.length) return
		const next = [...order]
		next.splice(index, 1)
		next.splice(target, 0, id)
		setOrder(next)
		onPersist(next)
	}

	return {
		order,
		dragId,
		move,
		rowRef: (id: string) => (element: HTMLElement | null) => {
			if (element) rows.current.set(id, element)
			else rows.current.delete(id)
		},
		// auf den Griff legen; nur dort startet das Ziehen, damit die Seite sonst normal scrollt
		handleProps: (id: string) => ({
			// Ziehen am Griff wechselt nicht den Tab (Karussell)
			"data-no-swipe": true,
			onPointerDown: (event: PointerEvent<HTMLElement>) => {
				if (event.button !== 0) return
				startDrag(id, event.pointerId)
			},
			// langes Drücken würde sonst das Kontextmenü öffnen und das Ziehen abbrechen
			onContextMenu: (event: { preventDefault: () => void }) => event.preventDefault(),
			onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
				if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return
				event.preventDefault()
				move(id, event.key === "ArrowUp" ? -1 : 1)
			},
		}),
	}
}
