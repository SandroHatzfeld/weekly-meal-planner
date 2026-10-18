"use client"

import { createCategory, deleteCategory, renameCategory } from "@/lib/grocery/actions"
import type { CategoryDTO } from "@/lib/grocery/categories"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

// Kategorien des Plans: anlegen, umbenennen, löschen (die Reihenfolge stellt jede Liste selbst ein)
export default function CategoryManager({ planId, categories }: { planId: string; categories: CategoryDTO[] }) {
	const router = useRouter()
	const [newName, setNewName] = useState("")
	const [error, setError] = useState<string | null>(null)
	const [pending, startTransition] = useTransition()

	const run = (action: () => Promise<{ error?: string } | void>, onSuccess?: () => void) =>
		startTransition(async () => {
			const result = await action()
			setError(result?.error ?? null)
			if (!result?.error) onSuccess?.()
			router.refresh()
		})

	return (
		<div className="space-y-2">
			<ul className="space-y-1">
				{categories.map((category) => (
					<li key={category.id} className="flex items-center gap-2">
						<CategoryName key={category.name} category={category} onRename={(name) => run(() => renameCategory(category.id, name))} />
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
				{categories.length === 0 && <li className="text-sm opacity-60">Noch keine Kategorien.</li>}
			</ul>
			{error && <p className="error">{error}</p>}
			<form
				className="flex gap-2"
				onSubmit={(event) => {
					event.preventDefault()
					run(() => createCategory(planId, newName), () => setNewName(""))
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
