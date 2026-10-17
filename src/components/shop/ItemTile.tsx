"use client"

import type { GroceryItemDTO } from "@/lib/dto"
import { useRef } from "react"

const LONG_PRESS_MS = 500
const MOVE_TOLERANCE_PX = 10

type ItemTileProps = {
	item: GroceryItemDTO
	onToggle: () => void
	onEdit: () => void
}

// Tippen = abhaken, Drücken und Halten (oder Rechtsklick / Kontextmenü-Taste) = bearbeiten
export default function ItemTile({ item, onToggle, onEdit }: ItemTileProps) {
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
	const start = useRef<{ x: number; y: number } | null>(null)
	const longPressed = useRef(false)

	const cancel = () => {
		if (timer.current) clearTimeout(timer.current)
		timer.current = null
		start.current = null
	}

	const openEditor = () => {
		longPressed.current = true
		cancel()
		navigator.vibrate?.(15)
		onEdit()
	}

	return (
		<button
			type="button"
			aria-pressed={item.checked}
			title="Tippen zum Abhaken · gedrückt halten oder Rechtsklick zum Bearbeiten"
			className={`flex aspect-[4/3] w-full touch-manipulation flex-col items-center justify-center gap-0.5 rounded-lg border p-2 text-center transition select-none [-webkit-touch-callout:none] ${
				item.checked
					? "border-transparent bg-black/5 text-(--foreground)/40 grayscale dark:bg-white/5"
					: "border-emerald-200 bg-emerald-50 text-emerald-950 shadow-sm active:scale-95 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-50"
			}`}
			onPointerDown={(event) => {
				longPressed.current = false
				start.current = { x: event.clientX, y: event.clientY }
				timer.current = setTimeout(openEditor, LONG_PRESS_MS)
			}}
			onPointerMove={(event) => {
				// beim Scrollen kein Long-Press auslösen
				if (start.current && Math.hypot(event.clientX - start.current.x, event.clientY - start.current.y) > MOVE_TOLERANCE_PX) cancel()
			}}
			onPointerUp={cancel}
			onPointerLeave={cancel}
			onPointerCancel={cancel}
			onContextMenu={(event) => {
				event.preventDefault()
				if (!longPressed.current) openEditor()
			}}
			onClick={() => {
				// Klick nach einem Long-Press nicht als Abhaken werten
				if (longPressed.current) {
					longPressed.current = false
					return
				}
				onToggle()
			}}
		>
			<span className={`line-clamp-2 max-w-full leading-tight font-semibold hyphens-auto [overflow-wrap:anywhere] ${item.checked ? "line-through" : ""}`}>{item.name}</span>
			{item.details && <span className="line-clamp-1 text-xs opacity-70">{item.details}</span>}
		</button>
	)
}
