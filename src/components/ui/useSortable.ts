"use client"

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react"

// Sortieren per Griff: Ziehen (Pointer Events, auch Touch) oder Pfeiltasten auf dem fokussierten Griff.
// ids kommen sortiert vom Server; onPersist speichert die neue Reihenfolge.
export const useSortable = (ids: string[], onPersist: (ids: string[]) => void) => {
	const [dragId, setDragId] = useState<string | null>(null)
	const [order, setOrder] = useState(ids)
	// neuer Stand vom Server (eigene oder fremde Änderung): übernehmen, solange nicht gezogen wird
	const signature = ids.join()
	const [synced, setSynced] = useState(signature)
	if (synced !== signature && !dragId) {
		setSynced(signature)
		setOrder(ids)
	}
	const rows = useRef(new Map<string, HTMLElement>())

	// Zeile an die Position verschieben, über deren Mitte der Finger gerade ist
	const dragTo = (clientY: number) => {
		if (!dragId) return
		const others = order.filter((id) => id !== dragId)
		let index = others.length
		for (let i = 0; i < others.length; i++) {
			const box = rows.current.get(others[i])?.getBoundingClientRect()
			if (box && clientY < box.top + box.height / 2) {
				index = i
				break
			}
		}
		const next = [...others.slice(0, index), dragId, ...others.slice(index)]
		if (next.join() !== order.join()) setOrder(next)
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
			onPointerDown: (event: PointerEvent<HTMLElement>) => {
				event.currentTarget.setPointerCapture(event.pointerId)
				setDragId(id)
			},
			onPointerMove: (event: PointerEvent<HTMLElement>) => dragTo(event.clientY),
			onPointerUp: () => {
				if (dragId) onPersist(order)
				setDragId(null)
			},
			onPointerCancel: () => {
				setDragId(null)
				setOrder(ids)
			},
			onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
				if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return
				event.preventDefault()
				move(id, event.key === "ArrowUp" ? -1 : 1)
			},
		}),
	}
}
