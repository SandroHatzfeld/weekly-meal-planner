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
	toggleGroceryItem,
} from "@/lib/grocery/actions"
import ItemEditDialog from "@/components/items/ItemEditDialog"
import ItemTile from "@/components/items/ItemTile"
import type { CategoryDTO, ProductMemoryDTO } from "@/lib/grocery/categories"
import Link from "next/link"
import ProductInput from "./ProductInput"
import { useProductMemory } from "./useProductMemory"
import { useStoredView, type ShopView } from "./useStoredView"
import { useRouter } from "next/navigation"
import { useState } from "react"

type ShopListProps = {
	lists: { id: string; name: string }[]
	tags: TagDTO[]
	categories: CategoryDTO[]
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

// Laden: nach Kategorie in Laden-Reihenfolge, ohne Kategorie zuletzt unter "Sonstiges"
const groupByCategory = (items: GroceryItemDTO[], categories: CategoryDTO[]): Group[] => {
	const groups = categories
		.map((category) => ({ key: category.id, title: category.name, items: items.filter((item) => item.categoryId === category.id) }))
		.filter((group) => group.items.length > 0)
	const known = new Set(categories.map((category) => category.id))
	const rest = items.filter((item) => !item.categoryId || !known.has(item.categoryId))
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

export default function ShopList({ lists, tags, categories, productMemory, initialListId, initialItems }: ShopListProps) {
	const router = useRouter()
	const [items, setItems] = useState(initialItems)
	const [listId, setListId] = useState(initialListId)
	const [name, setName] = useState("")
	const [details, setDetails] = useState("")
	// Kategorie aus einem gewählten Vorschlag; weitertippen setzt sie zurück
	const [pickedCategory, setPickedCategory] = useState<string | null>(null)
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

	const selectList = (id: string) => {
		setListId(id)
		router.replace(`/shop?list=${id}`, { scroll: false })
	}

	const visible = items.filter((item) => item.listId === listId)
	const listCategories = categories.filter((category) => category.listId === listId)
	const groups =
		view === "store" ? groupByCategory(visible, listCategories) : view === "alpha" ? sortAlphabetically(visible) : groupByDish(visible)

	const toggle = async (item: GroceryItemDTO) => {
		setItems((current) => upsert(current, { ...item, checked: !item.checked }))
		await toggleGroceryItem(item.id, !item.checked)
	}

	const currentList = lists.find((list) => list.id === listId)

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center gap-2">
				{lists.map((list) => (
					<button
						key={list.id}
						type="button"
						onClick={() => selectList(list.id)}
						className={list.id === listId ? "btn" : "btn-secondary"}
					>
						{list.name} ({items.filter((item) => item.listId === list.id && !item.checked).length})
					</button>
				))}
				{/* Ansicht: am Ende der Reiter-Zeile, bricht bei vielen Listen mit um */}
				<select
					aria-label="Ansicht"
					className="input ml-auto w-auto py-2"
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
							const item = await addGroceryItem(currentList.id, name, details, undefined, pickedCategory)
							if (item) {
								setItems((current) => upsert(current, item))
								learn(item)
							}
							setName("")
							setDetails("")
							setPickedCategory(null)
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
							onPick={(suggestion) => {
								setName(suggestion.displayName)
								setPickedCategory(suggestion.categoryId)
							}}
							memory={memory}
							categories={listCategories}
							listId={currentList.id}
						/>
						<input className="input min-w-0 flex-1 sm:w-36 sm:flex-none" placeholder="Details (z.B. 500 g)" value={details} onChange={(event) => setDetails(event.target.value)} />
						<button type="submit" className="btn">
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
												onEdit={() => setEditing(item)}
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
