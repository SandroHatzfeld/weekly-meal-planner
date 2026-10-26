"use client"

import { usePlanEvent } from "@/components/realtime/SocketProvider"
import type { GroceryItemDTO } from "@/lib/dto"
import { formatDay } from "@/lib/dates"
import { applyItemChanges } from "@/lib/grocery/client"
import type { TagDTO } from "@/lib/tags/icons"
import {
	addGroceryItem,
	clearCheckedItems,
	deleteGroceryItem,
} from "@/lib/grocery/actions"
import ItemEditDialog from "@/components/items/ItemEditDialog"
import ItemTile from "@/components/items/ItemTile"
import type { CategoryDTO, CategoryOrder, ProductMemoryDTO } from "@/lib/grocery/categories"
import { normalizeItemName } from "@/lib/grocery/normalize"
import { orderCategories } from "@/lib/grocery/order"
import Link from "next/link"
import TagPicker from "@/components/tags/TagPicker"
import ProductInput from "./ProductInput"
import { useProductMemory } from "./useProductMemory"
import { useStoredView, type ShopView } from "./useStoredView"
import { pendingToggles, sendToggle, useOnline } from "@/lib/offline/toggles"
import { useEffect, useState } from "react"

type ShopListProps = {
	lists: { id: string; name: string }[]
	tags: TagDTO[]
	categories: CategoryDTO[]
	categoryOrder: CategoryOrder
	hiddenCategories: CategoryOrder
	productMemory: ProductMemoryDTO[]
	initialListId: string | undefined
	initialItems: GroceryItemDTO[]
}

type Group = { key: string; title: string; href?: string; date?: string | null; items: GroceryItemDTO[] }

const VIEWS: { value: ShopView; label: string }[] = [
	{ value: "planning", label: "Planung" },
	{ value: "store", label: "Laden" },
	{ value: "alpha", label: "Alphabetisch" },
]

// Planung: nach Gericht ("Unkategorisiert" zuerst, dann nach Datum)
const groupByDish = (items: GroceryItemDTO[]): Group[] => {
	const groups = new Map<string, Group>()
	for (const item of items) {
		const key = item.dishId ?? ""
		if (!groups.has(key)) {
			groups.set(key, {
				key: key || "none",
				title: item.dishName ?? "Unkategorisiert",
				href: item.dishId ? `/dishes/${item.dishId}` : undefined,
				date: item.dishDate,
				items: [],
			})
		}
		groups.get(key)!.items.push(item)
	}
	return [...groups.values()].sort((a, b) =>
		a.key === "none" ? -1 : b.key === "none" ? 1 : (a.date ?? "").localeCompare(b.date ?? "") || a.title.localeCompare(b.title),
	)
}

// Laden: nach Kategorie in Laden-Reihenfolge, ohne Kategorie zuletzt unter "Sonstiges".
// categories = in dieser Liste sichtbare Kategorien. Ist die Kategorie des Eintrags hier ausgeblendet,
// gilt die erste sichtbare Ausweichkategorie des Produkts.
const groupByCategory = (items: GroceryItemDTO[], categories: CategoryDTO[], productCategories: Map<string, string[]>): Group[] => {
	const known = new Set(categories.map((category) => category.id))
	const effective = (item: GroceryItemDTO) =>
		item.categoryId && known.has(item.categoryId)
			? item.categoryId
			: (productCategories.get(normalizeItemName(item.name))?.find((id) => known.has(id)) ?? null)
	const byItem = new Map(items.map((item) => [item.id, effective(item)]))
	const groups = categories
		.map((category) => ({ key: category.id, title: category.name, items: items.filter((item) => byItem.get(item.id) === category.id) }))
		.filter((group) => group.items.length > 0)
	const rest = items.filter((item) => !byItem.get(item.id))
	if (rest.length) groups.push({ key: "rest", title: "Sonstiges", items: rest })
	for (const group of groups) group.items.sort((a, b) => a.name.localeCompare(b.name, "de"))
	return groups
}

const sortAlphabetically = (items: GroceryItemDTO[]): Group[] =>
	items.length ? [{ key: "alpha", title: "A–Z", items: [...items].sort((a, b) => a.name.localeCompare(b.name, "de")) }] : []

const upsert = (items: GroceryItemDTO[], item: GroceryItemDTO) => {
	const exists = items.some((existing) => existing.id === item.id)
	return exists ? items.map((existing) => (existing.id === item.id ? item : existing)) : [...items, item]
}

export default function ShopList({ lists, tags, categories, categoryOrder, hiddenCategories, productMemory, initialListId, initialItems }: ShopListProps) {
	const online = useOnline()
	const [items, setItems] = useState(initialItems)
	// neue Daten vom Server (z.B. nach dem Zurückkehren in die App): übernehmen, offline gesetzte Haken bleiben darüber liegen
	const [seenItems, setSeenItems] = useState(initialItems)
	if (initialItems !== seenItems) {
		setSeenItems(initialItems)
		const pending = pendingToggles()
		setItems(initialItems.map((item) => (item.id in pending ? { ...item, checked: pending[item.id] } : item)))
	}
	const [listId, setListId] = useState(initialListId)
	const [name, setName] = useState("")
	const [details, setDetails] = useState("")
	// Kategorie aus einem gewählten Vorschlag; weitertippen setzt sie zurück
	const [pickedCategory, setPickedCategory] = useState<string | null>(null)
	// Tags für den nächsten Eintrag (Dropdown neben dem Hinzufügen-Button)
	const [newTagIds, setNewTagIds] = useState<string[]>([])
	const [editing, setEditing] = useState<GroceryItemDTO | null>(null)
	const [view, setView] = useStoredView()
	const { memory, learn } = useProductMemory(productMemory)

	// Clients filtern anhand der listId im Payload selbst
	usePlanEvent("grocery-item-created", (item) => setItems((current) => upsert(current, item)))
	usePlanEvent("grocery-item-updated", (item) => setItems((current) => upsert(current, item)))
	usePlanEvent("grocery-item-moved", ({ item }) => setItems((current) => upsert(current, item)))
	usePlanEvent("grocery-item-checked", ({ id, checked }) =>
		setItems((current) => current.map((item) => (item.id === id ? { ...item, checked } : item))),
	)
	usePlanEvent("grocery-item-deleted", ({ id }) => setItems((current) => current.filter((item) => item.id !== id)))
	usePlanEvent("dish-deleted", ({ id }) =>
		setItems((current) => current.map((item) => (item.dishId === id ? { ...item, dishId: null, dishName: null, dishDate: null } : item))),
	)
	usePlanEvent("dish-updated", (dish) =>
		setItems((current) =>
			current.map((item) => (item.dishId === dish.id ? { ...item, dishName: dish.name, dishDate: dish.date } : item)),
		),
	)

	// noch nicht gesendete Haken (offline gesetzt) über den Stand der Seite legen, der ggf. aus dem Offline-Cache stammt
	useEffect(() => {
		const pending = pendingToggles()
		// einmalig beim Laden aus dem Gerätespeicher (kann beim Server-Rendern nicht gelesen werden)
		// eslint-disable-next-line react-hooks/set-state-in-effect
		if (Object.keys(pending).length) setItems((current) => current.map((item) => (item.id in pending ? { ...item, checked: pending[item.id] } : item)))
	}, [])

	const selectList = (id: string) => {
		setListId(id)
		// nur die Adresse anpassen (kein Server-Aufruf, geht auch offline)
		window.history.replaceState(null, "", `/shop?list=${id}`)
	}

	const visible = items.filter((item) => item.listId === listId)
	// ausgeblendete Kategorien gibt es in diesem Laden nicht: ihre Einträge landen unter "Sonstiges"
	const hidden = (listId && hiddenCategories[listId]) || []
	const listCategories = orderCategories(categories, listId ? categoryOrder[listId] : []).filter((category) => !hidden.includes(category.id))
	const groups =
		view === "store"
			? groupByCategory(visible, listCategories, new Map(memory.map((entry) => [normalizeItemName(entry.displayName), entry.categoryIds])))
			 : view === "alpha" ? sortAlphabetically(visible) : groupByDish(visible)

	const toggle = async (item: GroceryItemDTO) => {
		setItems((current) => upsert(current, { ...item, checked: !item.checked }))
		await sendToggle(item.id, !item.checked)
	}

	const currentList = lists.find((list) => list.id === listId)

	const add = async (targetListId: string, itemName: string, categoryId: string | null) => {
		const item = await addGroceryItem(targetListId, itemName, details, undefined, categoryId, newTagIds)
		if (item) {
			setItems((current) => upsert(current, item))
			learn(item)
		}
		setName("")
		setDetails("")
		setPickedCategory(null)
		setNewTagIds([])
	}

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center gap-2">
				{lists.map((list) => (
					<button
						key={list.id}
						type="button"
						onClick={() => selectList(list.id)}
						className={list.id === listId ? "btn border border-transparent" : "btn-secondary"}
					>
						{list.name} ({items.filter((item) => item.listId === list.id && !item.checked).length})
					</button>
				))}
				{/* Ansicht: am Ende der Reiter-Zeile, bricht bei vielen Listen mit um */}
				<select
					aria-label="Ansicht"
					className="input ml-auto w-auto py-[6.5px]"
					value={view}
					onChange={(event) => setView(event.target.value as ShopView)}
				>
					{VIEWS.map((option) => (
						<option key={option.value} value={option.value}>
							{option.label}
						</option>
					))}
				</select>
			</div>

			{currentList && (
				<>
					<form
						className="flex flex-wrap gap-2"
						onSubmit={async (event) => {
							event.preventDefault()
							await add(currentList.id, name, pickedCategory)
						}}
					>
						<ProductInput
							className="basis-full sm:basis-0 sm:flex-1"
							placeholder="Was wird gebraucht?"
							value={name}
							onChange={(value) => {
								setName(value)
								setPickedCategory(null)
							}}
							// Vorschlag gewählt: direkt hinzufügen (mit eventuell schon eingetragenen Details und Tags)
							onPick={(suggestion) => {
								if (online) return void add(currentList.id, suggestion.displayName, suggestion.categoryId)
								setName(suggestion.displayName)
								setPickedCategory(suggestion.categoryId)
							}}
							memory={memory}
							categories={categories}
							dropUp
						/>
						<input className="input min-w-0 flex-1 sm:w-36 sm:flex-none" placeholder="Details (z.B. 500 g)" value={details} onChange={(event) => setDetails(event.target.value)} />
						<TagPicker tags={tags} value={newTagIds} onChange={setNewTagIds} />
						<button type="submit" className="btn" disabled={!online} title={online ? undefined : "Offline nicht möglich"}>
							Hinzufügen
						</button>
					</form>

					{groups.length === 0 && <p className="opacity-60">Die Liste ist leer.</p>}
					{groups.map((group) => (
						<section key={group.key} className="card">
							<h3 className="mb-2 flex items-baseline gap-2 font-semibold">
								{group.href ? (
									<Link href={group.href} className="inline-flex min-w-0 items-center gap-1 py-1">
										<span className="truncate">{group.title}</span> <span aria-hidden="true">›</span>
									</Link>
								) : (
									group.title
								)}
								{group.date && (
									<time dateTime={group.date} className="ml-auto shrink-0 text-sm font-normal opacity-70">
										{formatDay(group.date, { weekday: "short", day: "2-digit", month: "2-digit" })}
									</time>
								)}
							</h3>
							<ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
								{/* abgehakte ans Ende, sonst Reihenfolge der Ansicht (stabil) */}
								{[...group.items]
									.sort((a, b) => Number(a.checked) - Number(b.checked))
									.map((item) => (
										<li key={item.id} className="flex">
											<ItemTile
												item={item}
												tags={tags}
												dimmed={item.checked}
												pressed={item.checked}
												hint="Tippen zum Abhaken · gedrückt halten oder Rechtsklick zum Bearbeiten"
												onToggle={() => toggle(item)}
												onEdit={() => online && setEditing(item)}
											/>
										</li>
									))}
							</ul>
						</section>
					))}

					<div className="flex flex-wrap gap-3 text-sm">
						<button
							type="button"
							className="btn-link"
							disabled={!online}
							onClick={async () => {
								setItems((current) => current.filter((item) => !(item.listId === currentList.id && item.checked)))
								await clearCheckedItems(currentList.id)
							}}
						>
							Abgehakte entfernen
						</button>
					</div>
				</>
			)}

			<ItemEditDialog
				item={editing}
				lists={lists}
				tags={tags}
				categories={categories}
				hiddenCategories={hiddenCategories}
				onClose={() => setEditing(null)}
				onSave={async (item, changes) => {
					const updated = await applyItemChanges(item, changes)
					setItems((current) => upsert(current, updated))
				}}
				onDelete={async (item) => {
					setItems((current) => current.filter((existing) => existing.id !== item.id))
					await deleteGroceryItem(item.id)
				}}
			/>
		</div>
	)
}
