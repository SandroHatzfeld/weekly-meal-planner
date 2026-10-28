"use client"

import { useFeedback } from "@/components/ui/Feedback"
import AddItemForm, { type NewItem } from "@/components/items/AddItemForm"
import ItemEditDialog from "@/components/items/ItemEditDialog"
import ItemTile from "@/components/items/ItemTile"
import RecipeRatingControl from "@/components/recipes/RecipeRatingControl"
import StarRating from "@/components/recipes/StarRating"
import { usePlanEvent, useSocket } from "@/components/realtime/SocketProvider"
import Dropdown from "@/components/ui/Dropdown"
import Icon, { iconButtonClass } from "@/components/ui/Icon"
import { deleteDish } from "@/lib/dishes/actions"
import type { DishDTO, GroceryItemDTO } from "@/lib/dto"
import { addGroceryItem, deleteGroceryItem } from "@/lib/grocery/actions"
import { sendToggle } from "@/lib/offline/toggles"
import { applyItemChanges } from "@/lib/grocery/client"
import type { CategoryDTO, ProductMemoryDTO } from "@/lib/grocery/categories"
import type { TagDTO } from "@/lib/tags/icons"
import { useProductMemory } from "@/components/shop/useProductMemory"
import { formatDay } from "@/lib/dates"
import { formatMinutes } from "@/lib/recipes/format"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

type SourceRecipe = { id: string; name: string; minutes: number | null; rating: number | null; userId: string }

type DishEditorProps = {
	initialDish: DishDTO
	initialItems: GroceryItemDTO[]
	lists: { id: string; name: string }[]
	defaultListId: string
	tags: TagDTO[]
	categories: CategoryDTO[]
	productMemory: ProductMemoryDTO[]
	sourceRecipe: SourceRecipe | null
	currentUserId: string
}

// Presence-Hinweis (nicht blockierend) über den Room dish:{id}
const usePresence = (dishId: string) => {
	const socket = useSocket()
	const [users, setUsers] = useState<{ userId: string; name: string }[]>([])

	useEffect(() => {
		if (!socket) return
		const join = async () => {
			const response = await fetch(`/api/socket/ticket?dishId=${dishId}`)
			if (response.ok) socket.emit("dish:join", (await response.json()).ticket)
		}
		const onPresence = (payload: { dishId: string; users: { userId: string; name: string }[] }) => {
			if (payload.dishId === dishId) setUsers(payload.users)
		}
		socket.on("presence-update", onPresence)
		// nach Reconnect erneut beitreten
		socket.on("connect", join)
		if (socket.connected) join()
		return () => {
			socket.emit("dish:leave", dishId)
			socket.off("presence-update", onPresence)
			socket.off("connect", join)
		}
	}, [socket, dishId])

	return users
}

// Gericht ansehen (wie die Rezeptseite): Kopf mit Rezept öffnen/Löschen, Bild, Datum, Zeit und Bewertung,
// darunter die Zutaten auf der Einkaufsliste. Bearbeitet wird das Rezept selbst.
export default function DishEditor({ initialDish, initialItems, lists, defaultListId, tags, categories, productMemory, sourceRecipe, currentUserId }: DishEditorProps) {
	const router = useRouter()
	const { confirm, attempt, undoable } = useFeedback()
	const [dish, setDish] = useState(initialDish)
	const [items, setItems] = useState(initialItems)
	const [editingItem, setEditingItem] = useState<GroceryItemDTO | null>(null)
	const [listId, setListId] = useState(defaultListId)
	const { memory } = useProductMemory(productMemory)

	const viewers = usePresence(dish.id)

	usePlanEvent("dish-updated", (updated) => {
		if (updated.id === dish.id) setDish(updated)
	})
	usePlanEvent("dish-deleted", ({ id }) => {
		if (id === dish.id) router.push("/week")
	})
	const upsertItem = (item: GroceryItemDTO) => setItems((current) => [...current.filter((existing) => existing.id !== item.id), item])
	usePlanEvent("grocery-item-created", (item) => {
		if (item.dishId === dish.id) upsertItem(item)
	})
	usePlanEvent("grocery-item-checked", ({ id, checked }) =>
		setItems((current) => current.map((item) => (item.id === id ? { ...item, checked } : item))),
	)
	usePlanEvent("grocery-item-deleted", ({ id }) => setItems((current) => current.filter((item) => item.id !== id)))
	// Bearbeitungen (auch aus der Einkaufsliste anderer Mitglieder) live übernehmen
	const replaceItem = (item: GroceryItemDTO) =>
		setItems((current) => current.map((existing) => (existing.id === item.id ? item : existing)))
	usePlanEvent("grocery-item-updated", replaceItem)
	usePlanEvent("grocery-item-moved", ({ item }) => replaceItem(item))

	const remove = async () => {
		if (!(await confirm({ title: "Gericht löschen?", message: "Die zugehörigen Einträge auf der Einkaufsliste bleiben erhalten.", confirmLabel: "Löschen", danger: true }))) return
		if ((await attempt(() => deleteDish(dish.id).then(() => true), "Löschen hat nicht geklappt")) === undefined) return
		router.push(`/week?start=${dish.date}`)
	}

	const addItem = async ({ name, details, categoryId, tagIds }: NewItem) => {
		const item = await attempt(() => addGroceryItem(listId, name, details, dish.id, categoryId, tagIds), "Konnte nicht hinzugefügt werden")
		if (!item) return false
		upsertItem(item)
		return true
	}

	const others = viewers.filter((viewer) => viewer.userId !== currentUserId).map((viewer) => viewer.name)
	const ownRecipe = sourceRecipe?.userId === currentUserId

	return (
		// unten Platz lassen: Listen- und Tag-Auswahl klappen nach unten auf und würden sonst abgeschnitten
		<article className="space-y-4 pb-64">
			{/* klebt unter der App-Kopfzeile, wie auf der Rezeptseite */}
			<div className="sticky top-(--app-header-h) z-10 -mx-4 -mt-4 border-b border-(--border) bg-(--background)/95 px-4 py-2 backdrop-blur-md">
				<Link
					href={`/week?start=${dish.date}`}
					className="btn-link text-sm"
					onClick={(event) => {
						// zurück dorthin, woher man kam (Woche, Monat, Einkaufsliste); ohne Verlauf (direkter Link) zur Woche des Gerichts
						if (window.history.length > 1) {
							event.preventDefault()
							router.back()
						}
					}}
				>
					← Zurück
				</Link>
				<div className="flex items-center gap-2">
					<h2 className="min-w-0 flex-1 truncate text-2xl font-semibold" title={dish.name}>
						{dish.name}
					</h2>
					{sourceRecipe && (
						<Link href={`/recipes/${sourceRecipe.id}`} className={iconButtonClass} aria-label={`Rezept „${sourceRecipe.name}“ öffnen`} title="Rezept öffnen">
							<Icon name="book" />
						</Link>
					)}
					<button type="button" className={`${iconButtonClass} text-red-700 dark:text-red-400`} aria-label="Gericht aus dem Plan löschen" title="Aus dem Plan löschen" onClick={remove}>
						<Icon name="calendarX" />
					</button>
				</div>
			</div>

			{others.length > 0 && <p className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-900">Gerade geöffnet von: {others.join(", ")}</p>}

			{dish.imageUrl && (
				// eslint-disable-next-line @next/next/no-img-element
				<img src={dish.imageUrl} alt={dish.name} className="max-h-72 w-full rounded object-cover" />
			)}
			<div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
				<span className="inline-flex items-center gap-1">
					<Icon name="calendar" className="size-4" />
					{formatDay(dish.date, { weekday: "long", day: "2-digit", month: "2-digit" })}
				</span>
				{!!sourceRecipe?.minutes && (
					<span className="inline-flex items-center gap-1">
						<Icon name="clock" className="size-4" />
						{formatMinutes(sourceRecipe.minutes)}
					</span>
				)}
				{/* Bewertung gehört zum Rezept: der Besitzer kann sie hier direkt ändern */}
				{sourceRecipe && ownRecipe && <RecipeRatingControl recipeId={sourceRecipe.id} initial={sourceRecipe.rating} />}
				{sourceRecipe && !ownRecipe && !!sourceRecipe.rating && <StarRating value={sourceRecipe.rating} className="size-4" />}
			</div>
			{dish.description && <p className="whitespace-pre-line">{dish.description}</p>}

			<section className="card space-y-3">
				<h2 className="font-semibold">Zutaten auf der Einkaufsliste</h2>
				{items.length > 0 ? (
					// gleiche Kacheln wie in der Einkaufsliste
					<ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
						{[...items]
							.sort((a, b) => Number(a.checked) - Number(b.checked))
							.map((item) => (
								<li key={item.id} className="flex">
									<ItemTile
										item={item}
										tags={tags}
										dimmed={item.checked}
										pressed={item.checked}
										hint="Tippen zum Abhaken · gedrückt halten oder Rechtsklick zum Bearbeiten"
										onToggle={async () => {
											replaceItem({ ...item, checked: !item.checked })
											const sent = await attempt(() => sendToggle(item.id, !item.checked), "Abhaken hat nicht geklappt")
											if (sent === undefined) replaceItem(item)
										}}
										onEdit={() => setEditingItem(item)}
									/>
								</li>
							))}
					</ul>
				) : (
					<p className="text-sm opacity-60">Alles eingekauft</p>
				)}
				<AddItemForm
					memory={memory}
					categories={categories}
					tags={tags}
					placeholder="Zutat hinzufügen"
					onAdd={addItem}
					extra={lists.length > 1 && <Dropdown label="Liste" value={listId} options={lists.map((list) => ({ value: list.id, label: list.name }))} onChange={setListId} className="w-32 shrink-0" />}
				/>
			</section>

			<ItemEditDialog
				item={editingItem}
				lists={lists}
				tags={tags}
				categories={categories}
				onClose={() => setEditingItem(null)}
				onSave={async (item, changes) => {
					const updated = await attempt(() => applyItemChanges(item, changes), "Änderung konnte nicht gespeichert werden")
					if (updated) replaceItem(updated)
					else router.refresh()
				}}
				onDelete={async (item) => {
					setItems((current) => current.filter((existing) => existing.id !== item.id))
					undoable({
						message: `„${item.name}“ gelöscht`,
						run: () => deleteGroceryItem(item.id),
						beacon: { url: "/api/grocery-items/delete", data: { ids: [item.id] } },
						onUndo: () => setItems((current) => (current.some((existing) => existing.id === item.id) ? current : [...current, item])),
						errorMessage: "Löschen hat nicht geklappt",
					})
				}}
			/>

		</article>
	)
}
