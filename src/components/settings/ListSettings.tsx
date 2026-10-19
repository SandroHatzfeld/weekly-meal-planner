"use client"

import Icon from "@/components/ui/Icon"
import { useSortable } from "@/components/ui/useSortable"
import { createGroceryList, deleteGroceryList, renameGroceryList, reorderGroceryLists, setDefaultGroceryList } from "@/lib/grocery/actions"
import type { CategoryDTO, CategoryOrder } from "@/lib/grocery/categories"
import { orderCategories } from "@/lib/grocery/order"
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
	hiddenIds,
	sortable,
}: {
	planId: string
	list: List
	isDefault: boolean
	canDelete: boolean
	categories: CategoryDTO[]
	hiddenIds: string[]
	sortable: ReturnType<typeof useSortable>
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
		<li ref={sortable.rowRef(list.id)} className={`space-y-1 py-2 ${sortable.dragId === list.id ? "rounded bg-(--surface) shadow-lg ring-2 ring-emerald-600" : ""}`}>
			<div className="flex items-center gap-1">
				{/* Griff: Reihenfolge der Listen (= Reiter in der Einkaufsliste) */}
				<button
					type="button"
					aria-label={`${list.name} verschieben`}
					title="Ziehen oder Pfeiltasten zum Sortieren"
					className="flex size-9 shrink-0 cursor-grab touch-none items-center justify-center opacity-60 select-none active:cursor-grabbing"
					{...sortable.handleProps(list.id)}
				>
					⋮⋮
				</button>
				<input className="input min-w-0 flex-1" value={name} aria-label="Name der Liste" onChange={(event) => setName(event.target.value)} />
				{dirty && (
					<button type="button" className="btn" disabled={pending || !name.trim()} onClick={() => run(() => renameGroceryList(list.id, name))}>
						Speichern
					</button>
				)}
				{/* Standardliste für Zutaten beim Planen: gefüllter Stern */}
				<button
					type="button"
					aria-pressed={isDefault}
					aria-label={isDefault ? `${list.name} ist die Standardliste` : `${list.name} als Standardliste`}
					title={isDefault ? "Standardliste beim Planen" : "Als Standardliste beim Planen verwenden"}
					disabled={pending || isDefault}
					onClick={() => run(() => setDefaultGroceryList(planId, list.id))}
					className={`flex size-9 shrink-0 items-center justify-center ${isDefault ? "text-amber-500" : "opacity-60 hover:opacity-100"}`}
				>
					<Icon name="star" filled={isDefault} />
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
			<button type="button" className="btn-link block text-sm" aria-expanded={showCategories} onClick={() => setShowCategories(!showCategories)}>
				{showCategories ? "▾" : "▸"} Kategorien im Laden – Reihenfolge, ausblenden
			</button>
			{showCategories && (
				<CategorySettings listId={list.id} categories={categories} hiddenIds={hiddenIds} />
			)}
		</li>
	)
}

export default function ListSettings({
	planId,
	lists,
	defaultListId,
	categories,
	categoryOrder,
	hiddenCategories,
}: {
	planId: string
	lists: List[]
	defaultListId: string
	categories: CategoryDTO[]
	categoryOrder: CategoryOrder
	hiddenCategories: CategoryOrder
}) {
	const router = useRouter()
	const [name, setName] = useState("")
	const [pending, startTransition] = useTransition()
	const sortable = useSortable(
		lists.map((list) => list.id),
		(ids) =>
			startTransition(async () => {
				await reorderGroceryLists(planId, ids)
				router.refresh()
			}),
	)
	const byId = new Map(lists.map((list) => [list.id, list]))
	const ordered = sortable.order.map((id) => byId.get(id)).filter((list): list is List => !!list)

	return (
		<div className="space-y-3">
			<ul className="divide-y divide-black/5 dark:divide-white/10">
				{ordered.map((list) => (
					// key mit Name: nach Umbenennen durch andere Mitglieder neu initialisieren
					<ListRow
						key={`${list.id}:${list.name}`}
						planId={planId}
						list={list}
						isDefault={list.id === defaultListId}
						canDelete={lists.length > 1}
						categories={orderCategories(categories, categoryOrder[list.id])}
						hiddenIds={hiddenCategories[list.id] ?? []}
						sortable={sortable}
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
