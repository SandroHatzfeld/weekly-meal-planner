"use client"

import { createGroceryList, deleteGroceryList, renameGroceryList, setDefaultGroceryList } from "@/lib/grocery/actions"
import type { CategoryDTO } from "@/lib/grocery/categories"
import { useRouter } from "next/navigation"
import CategorySettings from "./CategorySettings"
import { useState, useTransition } from "react"

type List = { id: string; name: string }

function ListRow({
	planId,
	list,
	isDefault,
	canDelete,
	categories,
}: {
	planId: string
	list: List
	isDefault: boolean
	canDelete: boolean
	categories: CategoryDTO[]
}) {
	const router = useRouter()
	const [name, setName] = useState(list.name)
	const [error, setError] = useState<string | null>(null)
	const [showCategories, setShowCategories] = useState(false)
	const [pending, startTransition] = useTransition()
	const dirty = name.trim() !== list.name

	const run = (action: () => Promise<unknown>) =>
		startTransition(async () => {
			await action()
			router.refresh()
		})

	return (
		<li className="space-y-1 py-2">
			<div className="flex flex-wrap items-center gap-2">
				<input className="input min-w-0 flex-1" value={name} aria-label="Name der Liste" onChange={(event) => setName(event.target.value)} />
				{dirty && (
					<button type="button" className="btn" disabled={pending || !name.trim()} onClick={() => run(() => renameGroceryList(list.id, name))}>
						Speichern
					</button>
				)}
				{/* Standardliste für Zutaten beim Planen */}
				<button
					type="button"
					aria-pressed={isDefault}
					disabled={pending || isDefault}
					onClick={() => run(() => setDefaultGroceryList(planId, list.id))}
					className={`rounded-full border px-3 py-1.5 text-sm ${isDefault ? "border-emerald-600 bg-emerald-700 text-white" : "border-(--border) opacity-70 hover:opacity-100"}`}
				>
					{isDefault ? "Standard" : "Als Standard"}
				</button>
				{canDelete && (
					<button
						type="button"
						className="btn-link flex size-9 shrink-0 items-center justify-center text-red-600"
						aria-label={`${list.name} löschen`}
						disabled={pending}
						onClick={() => {
							if (!confirm(`Liste "${list.name}" mit allen Einträgen löschen?`)) return
							run(async () => {
								const result = await deleteGroceryList(list.id)
								if (result?.error) setError(result.error)
							})
						}}
					>
						✕
					</button>
				)}
			</div>
			{error && <p className="error">{error}</p>}
			<button type="button" className="btn-link text-sm" aria-expanded={showCategories} onClick={() => setShowCategories(!showCategories)}>
				{showCategories ? "▾" : "▸"} Kategorien ({categories.length}) – Reihenfolge im Laden
			</button>
			{showCategories && (
				<CategorySettings listId={list.id} categories={categories} />
			)}
		</li>
	)
}

export default function ListSettings({
	planId,
	lists,
	defaultListId,
	categories,
}: {
	planId: string
	lists: List[]
	defaultListId: string
	categories: CategoryDTO[]
}) {
	const router = useRouter()
	const [name, setName] = useState("")
	const [pending, startTransition] = useTransition()

	return (
		<div className="space-y-3">
			<ul className="divide-y divide-black/5 dark:divide-white/10">
				{lists.map((list) => (
					// key mit Name: nach Umbenennen durch andere Mitglieder neu initialisieren
					<ListRow
						key={`${list.id}:${list.name}`}
						planId={planId}
						list={list}
						isDefault={list.id === defaultListId}
						canDelete={lists.length > 1}
						categories={categories.filter((category) => category.listId === list.id)}
					/>
				))}
			</ul>
			<form
				className="flex gap-2"
				onSubmit={(event) => {
					event.preventDefault()
					startTransition(async () => {
						if (await createGroceryList(planId, name)) setName("")
						router.refresh()
					})
				}}
			>
				<input className="input flex-1" placeholder="Neue Liste, z.B. Drogerie" value={name} onChange={(event) => setName(event.target.value)} required />
				<button type="submit" className="btn" disabled={pending}>
					Hinzufügen
				</button>
			</form>
		</div>
	)
}
