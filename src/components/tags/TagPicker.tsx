"use client"

import TagIcon from "@/components/tags/TagIcon"
import type { TagDTO } from "@/lib/tags/icons"
import { useEffect, useId, useRef, useState } from "react"

// Quadratischer Button mit Aufklapp-Auswahl der Plan-Tags (Mehrfachauswahl) für Formulare, z.B. beim Hinzufügen eines Produkts
// sizeClass: Größe des quadratischen Buttons, passend zur Höhe der Eingabefelder daneben
export default function TagPicker({ tags, value, onChange, sizeClass = "size-[34px]" }: { tags: TagDTO[]; value: string[]; onChange: (tagIds: string[]) => void; sizeClass?: string }) {
	const [open, setOpen] = useState(false)
	const root = useRef<HTMLDivElement>(null)
	const listId = useId()

	// Außenklick und Escape schließen
	useEffect(() => {
		if (!open) return
		const onPointerDown = (event: PointerEvent) => {
			if (!root.current?.contains(event.target as Node)) setOpen(false)
		}
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				// nur das Dropdown schließen, nicht das umgebende Popup (natives <dialog> schließt sonst bei Escape)
				event.preventDefault()
				event.stopPropagation()
				setOpen(false)
			}
		}
		document.addEventListener("pointerdown", onPointerDown)
		document.addEventListener("keydown", onKeyDown, true)
		return () => {
			document.removeEventListener("pointerdown", onPointerDown)
			document.removeEventListener("keydown", onKeyDown, true)
		}
	}, [open])

	if (tags.length === 0) return null
	const selected = tags.filter((tag) => value.includes(tag.id))

	return (
		<div ref={root} className="relative">
			<button
				type="button"
				aria-haspopup="listbox"
				aria-expanded={open}
				aria-controls={listId}
				aria-label={selected.length ? `Tags (${selected.map((tag) => tag.name).join(", ")})` : "Tags"}
				title="Tags"
				onClick={() => setOpen(!open)}
				className={`relative flex ${sizeClass} items-center justify-center rounded border ${selected.length ? "border-emerald-600 bg-emerald-700 text-white" : "border-(--border) bg-(--surface)"}`}
			>
				{selected.length === 1 ? <TagIcon icon={selected[0].icon} className="size-5" /> : <TagIcon icon="tag" className="size-5" />}
				{selected.length > 1 && (
					<span className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-white text-[10px] font-semibold text-emerald-800 shadow">
						{selected.length}
					</span>
				)}
			</button>
			{open && (
				<ul
					id={listId}
					role="listbox"
					aria-multiselectable="true"
					aria-label="Tags"
					className="absolute top-full right-0 z-20 mt-1 w-52 overflow-hidden rounded border border-(--border) bg-(--surface) shadow-lg"
				>
					{tags.map((tag) => {
						const active = value.includes(tag.id)
						return (
							<li key={tag.id} role="option" aria-selected={active}>
								<button
									type="button"
									onClick={() => onChange(active ? value.filter((id) => id !== tag.id) : [...value, tag.id])}
									className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${active ? "bg-emerald-100 dark:bg-emerald-900" : ""}`}
								>
									<TagIcon icon={tag.icon} className="size-4 shrink-0" />
									<span className="flex-1 truncate">{tag.name}</span>
									{active && <span aria-hidden="true">✓</span>}
								</button>
							</li>
						)
					})}
				</ul>
			)}
		</div>
	)
}
