"use client"

import { createCategory, deleteCategory, renameCategory, reorderCategories } from "@/lib/grocery/actions"
import type { CategoryDTO } from "@/lib/grocery/categories"
import { useRouter } from "next/navigation"
import { useRef, useState, useTransition } from "react"

// Kategorien einer Liste in Laden-Reihenfolge: umbenennen, löschen, anlegen, per Drag & Drop (oder ↑/↓) sortieren
export default function CategorySettings({ listId, categories }: { listId: string; categories: CategoryDTO[] }) {
	const router = useRouter()
	const [dragId, setDragId] = useState<string | null>(null)
	const [order, setOrder] = useState(() => categories.map((category) => category.id))
	// neuer Stand vom Server (eigene oder fremde Änderung): Reihenfolge übernehmen, Eingaben behalten
	const signature = categories.map((category) => `${category.id}:${category.position}`).join()
	const [syncedSignature, setSyncedSignature] = useState(signature)
	if (syncedSignature !== signature && !dragId) {
		setSyncedSignature(signature)
		setOrder(categories.map((category) => category.id))
	}
	const [newName, setNewName] = useState("")
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
		<div className="space-y-2">
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
						<CategoryName key={category.name} category={category} onRename={(name) => run(() => renameCategory(category.id, name))} />
						<div className="flex flex-col text-xs">
							<button type="button" className="btn-link" aria-label="Nach oben" disabled={index === 0 || pending} onClick={() => move(index, -1)}>
								↑
							</button>
							<button type="button" className="btn-link" aria-label="Nach unten" disabled={index === ordered.length - 1 || pending} onClick={() => move(index, 1)}>
								↓
							</button>
						</div>
						<button
							type="button"
							className="btn-link flex size-8 shrink-0 items-center justify-center text-red-600"
							aria-label={`${category.name} löschen`}
							disabled={pending}
							onClick={() => {
								if (confirm(`Kategorie "${category.name}" löschen? Einträge landen dann unter "Sonstiges".`)) run(() => deleteCategory(category.id))
							}}
						>
							✕
						</button>
					</li>
				))}
				{ordered.length === 0 && <li className="text-sm opacity-60">Noch keine Kategorien.</li>}
			</ol>
			<form
				className="flex gap-2"
				onSubmit={(event) => {
					event.preventDefault()
					run(async () => {
						await createCategory(listId, newName)
						setNewName("")
					})
				}}
			>
				<input className="input flex-1" placeholder="Neue Kategorie, z.B. Käsetheke" value={newName} onChange={(event) => setNewName(event.target.value)} required />
				<button type="submit" className="btn-secondary" disabled={pending}>
					Hinzufügen
				</button>
			</form>
		</div>
	)
}

function CategoryName({ category, onRename }: { category: CategoryDTO; onRename: (name: string) => void }) {
	const [name, setName] = useState(category.name)
	const dirty = name.trim() !== category.name && !!name.trim()
	return (
		<>
			<input
				className="input min-w-0 flex-1 py-1"
				aria-label="Name der Kategorie"
				value={name}
				onChange={(event) => setName(event.target.value)}
				onKeyDown={(event) => {
					if (event.key === "Enter" && dirty) {
						event.preventDefault()
						onRename(name)
					}
				}}
			/>
			{dirty && (
				<button type="button" className="btn py-1 text-sm" onClick={() => onRename(name)}>
					Speichern
				</button>
			)}
		</>
	)
}
