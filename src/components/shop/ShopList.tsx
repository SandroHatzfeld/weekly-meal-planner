"use client"

import { usePlanEvent } from "@/components/realtime/SocketProvider"
import type { GroceryItemDTO } from "@/lib/dto"
import { formatDay } from "@/lib/dates"
import { applyItemChanges } from "@/lib/grocery/client"
import type { TagDTO } from "@/lib/tags/icons"
import {
	addGroceryItem,
	deleteGroceryItem,
} from "@/lib/grocery/actions"
import ItemEditDialog from "@/components/items/ItemEditDialog"
import AddItemForm, { type NewItem } from "@/components/items/AddItemForm"
import ItemTile from "@/components/items/ItemTile"
import type { CategoryDTO, CategoryOrder, ProductMemoryDTO } from "@/lib/grocery/categories"
import { normalizeItemName } from "@/lib/grocery/normalize"
import { orderCategories } from "@/lib/grocery/order"
import Link from "next/link"
import { useProductMemory } from "./useProductMemory"
import { useShowChecked, useStoredView, type ShopView } from "./useStoredView"
import { pendingToggles, sendToggle, useOnline } from "@/lib/offline/toggles"
import { useFeedback } from "@/components/ui/Feedback"
import { useRouter } from "next/navigation"
import Hint from "@/components/hints/Hints"
import Icon from "@/components/ui/Icon"
import Dropdown from "@/components/ui/Dropdown"
import { useEffect, useRef, useState } from "react"

type ShopListProps = {
	lists: { id: string; name: string }[]
	tags: TagDTO[]
	categories: CategoryDTO[]
	categoryOrder: CategoryOrder
	hiddenCategories: CategoryOrder
	productMemory: ProductMemoryDTO[]
	initialListId: string | undefined
	initialItems: GroceryItemDTO[]
	// Zutaten von Gerichten vor heute gehören nicht mehr auf die Einkaufsliste
	today: string
}

type Group = { key: string; title: string; href?: string; date?: string | null; items: GroceryItemDTO[] }

const VIEWS: { value: ShopView; label: string }[] = [
	{ value: "planning", label: "Planung" },
	{ value: "store", label: "Laden" },
	{ value: "alpha", label: "A–Z" },
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

export default function ShopList({ lists, tags, categories, categoryOrder, hiddenCategories, productMemory, initialListId, initialItems, today }: ShopListProps) {
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
	const [editing, setEditing] = useState<GroceryItemDTO | null>(null)
	// Hinzufügen-Formular: Details/Tags erst beim Tippen einblenden; ist es weggescrollt, erscheint ein „+“-Button
	const formRef = useRef<HTMLFormElement>(null)
	const listBar = useRef<HTMLDivElement>(null)
	const [formVisible, setFormVisible] = useState(true)
	const [view, setView] = useStoredView()
	const [showChecked, setShowChecked] = useShowChecked()
	// in dieser Sitzung abgehakt: bleiben stehen, damit ein Fehltipp sichtbar bleibt und rückgängig gemacht werden kann
	const [justChecked, setJustChecked] = useState<Set<string>>(() => new Set())
	const { memory, learn } = useProductMemory(productMemory)
	const { attempt, undoable } = useFeedback()
	const router = useRouter()

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

	useEffect(() => {
		const form = formRef.current
		if (!form) return
		const observer = new IntersectionObserver(([entry]) => setFormVisible(entry.isIntersecting))
		observer.observe(form)
		return () => observer.disconnect()
	}, [])

	// gewählte Liste in der Leiste sichtbar halten (von Hand: scrollIntoView würde auch das Karussell verschieben)
	useEffect(() => {
		const bar = listBar.current
		const chip = bar?.querySelector<HTMLElement>("[aria-pressed=true]")
		if (!bar || !chip) return
		if (chip.offsetLeft < bar.scrollLeft) bar.scrollLeft = chip.offsetLeft - 8
		else if (chip.offsetLeft + chip.offsetWidth > bar.scrollLeft + bar.clientWidth) bar.scrollLeft = chip.offsetLeft + chip.offsetWidth - bar.clientWidth + 8
	}, [listId])

	const showForm = () => {
		const form = formRef.current
		form?.closest("[data-tab-panel]")?.scrollTo({ top: 0, behavior: "smooth" })
		form?.querySelector("input")?.focus({ preventScroll: true })
	}

	const selectList = (id: string) => {
		setListId(id)
		// nur die Adresse anpassen (kein Server-Aufruf, geht auch offline)
		window.history.replaceState(null, "", `/shop?list=${id}`)
	}

	// Einträge vergangener Gerichte bleiben nur auf der Gericht-Seite sichtbar
	const current = items.filter((item) => !item.dishDate || item.dishDate >= today)
	const inList = current.filter((item) => item.listId === listId)
	const hiddenChecked = inList.filter((item) => item.checked && !justChecked.has(item.id)).length
	const visible = showChecked ? inList : inList.filter((item) => !item.checked || justChecked.has(item.id))
	// ausgeblendete Kategorien gibt es in diesem Laden nicht: ihre Einträge landen unter "Sonstiges"
	const hidden = (listId && hiddenCategories[listId]) || []
	const listCategories = orderCategories(categories, listId ? categoryOrder[listId] : []).filter((category) => !hidden.includes(category.id))
	const groups =
		view === "store"
			? groupByCategory(visible, listCategories, new Map(memory.map((entry) => [normalizeItemName(entry.displayName), entry.categoryIds])))
			 : view === "alpha" ? sortAlphabetically(visible) : groupByDish(visible)

	const toggle = async (item: GroceryItemDTO) => {
		if (!item.checked) setJustChecked((ids) => new Set(ids).add(item.id))
		setItems((current) => upsert(current, { ...item, checked: !item.checked }))
		// ohne Verbindung wird der Haken gemerkt; andere Fehler: zurücksetzen und melden
		const sent = await attempt(() => sendToggle(item.id, !item.checked), "Abhaken hat nicht geklappt")
		if (sent === undefined) setItems((current) => current.map((existing) => (existing.id === item.id ? { ...existing, checked: item.checked } : existing)))
	}

	const currentList = lists.find((list) => list.id === listId)

	const add = async (targetListId: string, { name, details, categoryId, tagIds }: NewItem) => {
		const item = await attempt(() => addGroceryItem(targetListId, name, details, undefined, categoryId, tagIds), "Konnte nicht hinzugefügt werden")
		// bei einem Fehler bleibt die Eingabe stehen, damit man es erneut versuchen kann
		if (!item) return false
		setItems((current) => upsert(current, item))
		learn(item)
		return true
	}

	return (
		<div className="space-y-4">
			{/* Listen als seitlich scrollbare Leiste (Pillen, damit sie sich von den Tabs oben abheben), Ansicht daneben */}
			<div className="flex items-center gap-2">
				<div ref={listBar} className="-my-1 flex min-w-0 flex-1 gap-2 overflow-x-auto py-1 [scrollbar-width:none]" aria-label="Einkaufslisten">
					{lists.map((list) => {
						const active = list.id === listId
						const open = current.filter((item) => item.listId === list.id && !item.checked).length
						return (
							<button
								key={list.id}
								type="button"
								aria-pressed={active}
								onClick={() => selectList(list.id)}
								className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm whitespace-nowrap ${active ? "border-emerald-700 bg-emerald-700 text-white" : "border-(--border) bg-(--surface)"}`}
							>
								{list.name}
								<span className={`min-w-5 rounded-full px-1.5 text-center text-xs ${active ? "bg-white/20" : "bg-black/5 dark:bg-white/10"}`}>{open}</span>
							</button>
						)
					})}
				</div>
				<Dropdown label="Ansicht" value={view} options={VIEWS} onChange={setView} className="w-28 shrink-0" />
			</div>

			{currentList && (
				<>
					<AddItemForm
						formRef={formRef}
						memory={memory}
						categories={categories}
						tags={tags}
						placeholder="Was wird gebraucht?"
						disabled={!online}
						disabledTitle="Offline nicht möglich"
						onAdd={(item) => add(currentList.id, item)}
					/>

					<Hint id="shop-basics" title="So funktioniert die Einkaufsliste">
						<ul className="list-disc space-y-0.5 pl-4">
							<li>Tippen hakt einen Eintrag ab, nochmal tippen holt ihn zurück.</li>
							<li>Gedrückt halten (am Computer: Rechtsklick) öffnet die Bearbeitung.</li>
							<li>Nach links oder rechts wischen wechselt zwischen Einkaufsliste, Woche, Monat und Rezepten.</li>
						</ul>
					</Hint>

					{groups.length === 0 && <p className="opacity-60">{hiddenChecked > 0 ? "Alles eingekauft." : "Die Liste ist leer."}</p>}
					{groups.map((group) => (
						<section key={group.key} className="card">
							<h2 className="mb-2 flex items-baseline gap-2 font-semibold">
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
							</h2>
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

					{(showChecked || hiddenChecked > 0) && (
						<div className="flex flex-wrap gap-3 text-sm">
							<button type="button" className="btn-link" aria-pressed={showChecked} onClick={() => setShowChecked(!showChecked)}>
								{showChecked ? "Abgehakte ausblenden" : `Abgehakte einblenden (${hiddenChecked})`}
							</button>
						</div>
					)}
				</>
			)}

			{/* Formular weggescrollt: schwebender Button holt es zurück */}
			{currentList && !formVisible && (
				<div className="pointer-events-none sticky bottom-4 flex justify-end">
					<button
						type="button"
						className="pointer-events-auto flex size-14 items-center justify-center rounded-full bg-emerald-700 text-white shadow-lg hover:bg-emerald-800"
						aria-label="Eintrag hinzufügen"
						onClick={showForm}
					>
						<Icon name="plus" className="size-7" />
					</button>
				</div>
			)}

			<ItemEditDialog
				item={editing}
				lists={lists}
				tags={tags}
				categories={categories}
				hiddenCategories={hiddenCategories}
				onClose={() => setEditing(null)}
				onSave={async (item, changes) => {
					const updated = await attempt(() => applyItemChanges(item, changes), "Änderung konnte nicht gespeichert werden")
					if (updated) setItems((current) => upsert(current, updated))
					// Stand vom Server holen, damit die Anzeige nicht von der Datenbank abweicht
					else router.refresh()
				}}
				onDelete={async (item) => {
					setItems((current) => current.filter((existing) => existing.id !== item.id))
					undoable({
						message: `„${item.name}“ gelöscht`,
						run: () => deleteGroceryItem(item.id),
					beacon: { url: "/api/grocery-items/delete", data: { ids: [item.id] } },
						onUndo: () => setItems((current) => upsert(current, item)),
						errorMessage: "Löschen hat nicht geklappt",
					})
				}}
			/>
		</div>
	)
}
