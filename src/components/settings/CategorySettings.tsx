"use client"

import { reorderCategories } from "@/lib/grocery/actions"
import type { CategoryDTO } from "@/lib/grocery/categories"
import { useRouter } from "next/navigation"
import { useRef, useState, useTransition } from "react"

// Reihenfolge der Kategorien im Laden für eine Liste, per Drag & Drop (oder ↑/↓); categories kommen bereits sortiert
export default function CategorySettings({ listId, categories }: { listId: string; categories: CategoryDTO[] }) {
	const router = useRouter()
	const [dragId, setDragId] = useState<string | null>(null)
	const [order, setOrder] = useState(() => categories.map((category) => category.id))
	// neuer Stand vom Server (eigene oder fremde Änderung): Reihenfolge übernehmen, Eingaben behalten
	const signature = categories.map((category) => category.id).join()
	const [syncedSignature, setSyncedSignature] = useState(signature)
	if (syncedSignature !== signature && !dragId) {
		setSyncedSignature(signature)
		setOrder(categories.map((category) => category.id))
	}
	const [pending, startTransition] = useTransition()
	const rows = useRef(new Map<string, HTMLLIElement>())
	const byId = new Map(categories.map((category) => [category.id, category]))
	const ordered = order.map((id) => byId.get(id)).filter((category): category is CategoryDTO => !!category)

	const run = (action: () => Promise<unknown>) =>
		startTransition(async () => {
			await action()
			router.refresh()
		})

	const persist = (ids: string[]) => run(() => reorderCategories(listId, ids))

	const move = (index: number, delta: number) => {
		const next = [...order]
		const [id] = next.splice(index, 1)
		next.splice(index + delta, 0, id)
		setOrder(next)
		persist(next)
	}

	// beim Ziehen: Zeile an die Position verschieben, über deren Mitte der Finger gerade ist
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

	return (
		<ol className="space-y-1">
			{ordered.map((category, index) => (
				<li
					key={category.id}
					ref={(element) => {
						if (element) rows.current.set(category.id, element)
						else rows.current.delete(category.id)
					}}
					className={`flex items-center gap-2 rounded border bg-(--surface) px-2 py-1 ${dragId === category.id ? "border-emerald-600 shadow-lg" : "border-(--border)"}`}
				>
					{/* Griff: nur hier startet Drag & Drop, damit die Seite sonst normal scrollt */}
					<button
						type="button"
						aria-label={`${category.name} verschieben`}
						title="Ziehen zum Sortieren"
						className="flex size-8 shrink-0 cursor-grab touch-none items-center justify-center opacity-60 select-none active:cursor-grabbing"
						onPointerDown={(event) => {
							event.currentTarget.setPointerCapture(event.pointerId)
							setDragId(category.id)
						}}
						onPointerMove={(event) => dragTo(event.clientY)}
						onPointerUp={() => {
							if (dragId) persist(order)
							setDragId(null)
						}}
						onPointerCancel={() => setDragId(null)}
					>
						⋮⋮
					</button>
					<span className="min-w-0 flex-1 truncate">{category.name}</span>
					<div className="flex flex-col text-xs">
						<button type="button" className="btn-link" aria-label="Nach oben" disabled={index === 0 || pending} onClick={() => move(index, -1)}>
							↑
						</button>
						<button type="button" className="btn-link" aria-label="Nach unten" disabled={index === ordered.length - 1 || pending} onClick={() => move(index, 1)}>
							↓
						</button>
					</div>
				</li>
			))}
			{ordered.length === 0 && <li className="text-sm opacity-60">Noch keine Kategorien.</li>}
		</ol>
	)
}
