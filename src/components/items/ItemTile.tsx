"use client"

import TagIcon from "@/components/tags/TagIcon"
import type { TagDTO } from "@/lib/tags/icons"
import { useRef } from "react"

const LONG_PRESS_MS = 500
const MOVE_TOLERANCE_PX = 10

type ItemTileProps = {
	item: { name: string; details: string | null; tagIds: string[] }
	tags: TagDTO[]
	dimmed: boolean // ausgegraut: abgehakt (Einkaufsliste) bzw. nicht übernehmen (Planen)
	pressed: boolean
	hint: string
	onToggle: () => void
	onEdit: () => void
}

// Beim Loslassen nach dem Gedrückthalten feuert der Browser einen Klick an der Fingerposition.
// Dort liegt dann schon das Popup (z.B. "Löschen" oder ein Tag-Button) – diesen einen Klick verwerfen.
const swallowReleaseClick = () => {
	const swallow = (event: MouseEvent) => {
		event.preventDefault()
		event.stopPropagation()
		cleanup()
	}
	const release = () => setTimeout(cleanup, 400) // kommt kein Klick, nicht ewig blockieren
	const cleanup = () => {
		window.removeEventListener("click", swallow, true)
		window.removeEventListener("pointerup", release, true)
		window.removeEventListener("pointercancel", release, true)
		window.removeEventListener("touchend", release, true)
	}
	window.addEventListener("click", swallow, true)
	window.addEventListener("pointerup", release, true)
	window.addEventListener("pointercancel", release, true)
	window.addEventListener("touchend", release, true)
}

// Tippen = umschalten, Drücken und Halten (oder Rechtsklick / Kontextmenü-Taste) = bearbeiten.
// Genutzt in der Einkaufsliste und bei der Zutatenauswahl beim Planen.
// Mindestens 4:3, wächst mit dem Inhalt; das umgebende <li className="flex"> gleicht die Höhe innerhalb einer Reihe an.
export default function ItemTile({ item, tags, dimmed, pressed, hint, onToggle, onEdit }: ItemTileProps) {
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
	const start = useRef<{ x: number; y: number } | null>(null)
	const longPressed = useRef(false)

	// Reihenfolge wie in den Einstellungen; gelöschte Tags fallen raus
	const itemTags = tags.filter((tag) => item.tagIds.includes(tag.id))

	const cancel = () => {
		if (timer.current) clearTimeout(timer.current)
		timer.current = null
		start.current = null
	}

	const openEditor = (byLongPress: boolean) => {
		longPressed.current = true
		cancel()
		// nur beim Gedrückthalten: nach einem Rechtsklick folgt kein Klick (unter Windows ist die Maus dann schon oben)
		if (byLongPress) swallowReleaseClick()
		navigator.vibrate?.(15)
		onEdit()
	}

	return (
		<button
			type="button"
			aria-pressed={pressed}
			title={hint}
			className={`flex aspect-[4/3] w-full touch-manipulation flex-col items-stretch gap-0.5 rounded-lg border p-2 text-center transition select-none [-webkit-touch-callout:none] ${
				dimmed
					? "border-transparent bg-black/5 text-(--foreground)/40 grayscale dark:bg-white/5"
					: "border-emerald-200 bg-emerald-50 text-emerald-950 shadow-sm active:scale-95 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-50"
			}`}
			onPointerDown={(event) => {
				longPressed.current = false
				if (event.button !== 0) return // Rechtsklick läuft über onContextMenu
				start.current = { x: event.clientX, y: event.clientY }
				timer.current = setTimeout(() => openEditor(true), LONG_PRESS_MS)
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
				// Android meldet Gedrückthalten auch als Kontextmenü – liegt der Finger noch auf, wie Gedrückthalten behandeln
				if (!longPressed.current) openEditor(start.current !== null)
			}}
			onClick={() => {
				// Klick nach einem Long-Press nicht als Umschalten werten
				if (longPressed.current) {
					longPressed.current = false
					return
				}
				onToggle()
			}}
		>
			{/* Tags als eigene Zeile im Fluss: nichts überlagert den Namen, die Kachel wächst bei Bedarf */}
			{itemTags.length > 0 && (
				<span className="-mt-1 -mr-1 flex justify-end gap-0.5 text-emerald-700 dark:text-emerald-300">
					{itemTags.map((tag) => (
						<TagIcon key={tag.id} icon={tag.icon} className="size-3.5" />
					))}
					<span className="sr-only">Tags: {itemTags.map((tag) => tag.name).join(", ")}</span>
				</span>
			)}
			<span className="flex flex-1 flex-col items-center justify-center gap-0.5">
				<span className={`line-clamp-2 max-w-full leading-tight font-semibold hyphens-auto [overflow-wrap:anywhere] ${dimmed ? "line-through" : ""}`}>{item.name}</span>
				{item.details && <span className="line-clamp-1 text-xs opacity-70">{item.details}</span>}
			</span>
		</button>
	)
}
