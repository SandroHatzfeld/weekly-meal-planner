"use client"

import { useFeedback } from "@/components/ui/Feedback"
import ImageField from "@/components/forms/ImageField"
import AddItemForm, { type NewItem } from "@/components/items/AddItemForm"
import ItemEditDialog from "@/components/items/ItemEditDialog"
import ItemTile from "@/components/items/ItemTile"
import RecipeRatingControl from "@/components/recipes/RecipeRatingControl"
import StarRating from "@/components/recipes/StarRating"
import { usePlanEvent, useSocket } from "@/components/realtime/SocketProvider"
import Dropdown from "@/components/ui/Dropdown"
import Icon, { iconButtonClass } from "@/components/ui/Icon"
import Modal from "@/components/ui/Modal"
import { deleteDish, updateDish, type DishInput } from "@/lib/dishes/actions"
import type { DishDTO, GroceryItemDTO } from "@/lib/dto"
import { addGroceryItem, deleteGroceryItem } from "@/lib/grocery/actions"
import { sendToggle } from "@/lib/offline/toggles"
import { applyItemChanges } from "@/lib/grocery/client"
import type { CategoryDTO, ProductMemoryDTO } from "@/lib/grocery/categories"
import type { TagDTO } from "@/lib/tags/icons"
import { useProductMemory } from "@/components/shop/useProductMemory"
import { formatDay, PAST_DAY_MESSAGE } from "@/lib/dates"
import { formatMinutes } from "@/lib/recipes/format"
import { canGoBackInApp } from "@/lib/navigation"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

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
	today: string
}

const toInput = (dish: DishDTO): DishInput => ({
	name: dish.name,
	description: dish.description ?? "",
	imageUrl: dish.imageUrl ?? "",
	steps: dish.steps,
	date: dish.date,
})

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

// Gericht ansehen (wie die Rezeptseite): Kopf mit Rezept öffnen/Bearbeiten/Löschen, Bild, Datum, Zeit und Bewertung,
// darunter die Zutaten auf der Einkaufsliste. Das Datum lässt sich immer im Popup ändern; Name, Beschreibung und Bild
// nur bei Gerichten ohne Rezept (sonst wird das Rezept bearbeitet).
export default function DishEditor({ initialDish, initialItems, lists, defaultListId, tags, categories, productMemory, sourceRecipe, currentUserId, today }: DishEditorProps) {
	const router = useRouter()
	const { confirm, attempt, undoable, notify } = useFeedback()
	const [dish, setDish] = useState(initialDish)
	const [form, setForm] = useState(toInput(initialDish))
	// Popup: alles bearbeiten oder nur das Datum
	const [editing, setEditing] = useState<"all" | "date" | null>(null)
	const [dirty, setDirty] = useState(false)
	const [remoteChange, setRemoteChange] = useState<DishDTO | null>(null)
	const [conflict, setConflict] = useState<DishDTO | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [items, setItems] = useState(initialItems)
	const [editingItem, setEditingItem] = useState<GroceryItemDTO | null>(null)
	const [listId, setListId] = useState(defaultListId)
	const { memory } = useProductMemory(productMemory)
	const [saving, setSaving] = useState(false)

	const viewers = usePresence(dish.id)

	usePlanEvent("dish-updated", (updated) => {
		if (updated.id !== dish.id || updated.updatedAt === dish.updatedAt) return
		// ohne lokale Änderungen direkt übernehmen, sonst nur Hinweis im Bearbeiten-Popup
		if (dirty) return setRemoteChange(updated)
		setDish(updated)
		setForm(toInput(updated))
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

	const update = (patch: Partial<DishInput>) => {
		setForm((current) => ({ ...current, ...patch }))
		setDirty(true)
	}

	const reload = (latest: DishDTO) => {
		setDish(latest)
		setForm(toInput(latest))
		setDirty(false)
		setConflict(null)
		setRemoteChange(null)
	}

	const closeEdit = () => {
		// Abbrechen verwirft ungespeicherte Änderungen
		reload(dish)
		setError(null)
		setEditing(null)
	}

	const save = async (event: React.FormEvent) => {
		event.preventDefault()
		setSaving(true)
		setError(null)
		const result = await attempt(() => updateDish(dish.id, form, dish.updatedAt), "Speichern hat nicht geklappt")
		setSaving(false)
		if (!result) return
		if (result.ok) {
			reload(result.dish)
			setEditing(null)
		} else if ("conflict" in result) {
			if (!result.current) return router.push("/week")
			setConflict(result.current)
		} else {
			setError(result.error)
		}
	}

	// Datum direkt über den Kalender des Systems ändern (ohne eigenes Popup)
	const datePicker = useRef<HTMLInputElement>(null)
	const openDatePicker = () => {
		try {
			datePicker.current?.showPicker()
		} catch {
			// Browser ohne showPicker: Popup mit Datumsfeld
			setEditing("date")
		}
	}
	const changeDate = async (date: string) => {
		if (!date || date === dish.date) return
		if (date < today) return notify(PAST_DAY_MESSAGE, { tone: "error" })
		const result = await attempt(() => updateDish(dish.id, { ...toInput(dish), date }, dish.updatedAt), "Datum konnte nicht geändert werden")
		if (!result) return
		if (result.ok) return reload(result.dish)
		if ("conflict" in result) {
			if (!result.current) return router.push("/week")
			reload(result.current)
			return notify("Das Gericht wurde inzwischen geändert. Bitte erneut versuchen.", { tone: "error" })
		}
		notify(result.error, { tone: "error" })
	}

	const remove = async () => {
		if (!(await confirm({ title: "Gericht löschen?", message: "Seine Zutaten werden auch von der Einkaufsliste entfernt.", confirmLabel: "Löschen", danger: true }))) return
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
						if (canGoBackInApp()) {
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
					{!sourceRecipe && (
						<button type="button" className={iconButtonClass} aria-label="Gericht bearbeiten" title="Bearbeiten" onClick={() => setEditing("all")}>
							<Icon name="pencil" />
						</button>
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
					<span className="relative">
						<button type="button" className="btn-link -my-2 -mx-2 size-11 justify-center px-0" aria-label="Datum ändern" title="Datum ändern" onClick={openDatePicker}>
							<Icon name="pencil" className="size-4" />
						</button>
						{/* unsichtbares Datumsfeld am Stift: der Kalender des Systems öffnet sich dort */}
						<input
							ref={datePicker}
							data-date-picker
							type="date"
							tabIndex={-1}
							aria-hidden="true"
							className="pointer-events-none absolute inset-0 size-full opacity-0"
							value={dish.date}
							min={dish.date < today ? undefined : today}
							onChange={(event) => changeDate(event.target.value)}
						/>
					</span>
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

			<Modal open={!!editing} onClose={closeEdit} labelledBy="dish-edit-title" focusDialog widthClass="w-[min(32rem,calc(100%-2rem))]">
				<form onSubmit={save} className="form max-w-none gap-3 p-4">
					<h2 id="dish-edit-title" className="text-lg font-semibold">
						{editing === "date" ? "Datum ändern" : "Gericht bearbeiten"}
					</h2>
					{conflict && (
						<div className="notice text-sm">
							Das Gericht wurde inzwischen von jemand anderem geändert.
							<button type="button" className="btn ml-2" onClick={() => reload(conflict)}>
								Neu laden
							</button>
							<span className="ml-2 text-xs opacity-70">(deine Änderungen gehen dabei verloren)</span>
						</div>
					)}
					{remoteChange && !conflict && (
						<div className="notice text-sm">
							Es gibt eine neuere Version dieses Gerichts.
							<button type="button" className="btn ml-2" onClick={() => reload(remoteChange)}>
								Neu laden
							</button>
						</div>
					)}
					{editing === "all" && (
						<>
							<label htmlFor="dish-name">Name</label>
							<input id="dish-name" value={form.name} onChange={(event) => update({ name: event.target.value })} required />
						</>
					)}
					<label htmlFor="dish-date">Datum</label>
					<input
						id="dish-date"
						type="date"
						value={form.date}
						// ein Gericht an einem vergangenen Tag bleibt bearbeitbar, ein vergangenes Datum lässt sich aber nicht neu wählen
						min={dish.date < today ? undefined : today}
						onChange={(event) => update({ date: event.target.value })}
						ref={(element) => element?.setCustomValidity(form.date < today && form.date !== dish.date ? PAST_DAY_MESSAGE : "")}
						required
					/>
					{editing === "all" && (
						<>
							<label htmlFor="dish-description">Beschreibung</label>
							<textarea id="dish-description" rows={3} value={form.description} onChange={(event) => update({ description: event.target.value })} />
							<ImageField value={form.imageUrl} onChange={(imageUrl) => update({ imageUrl })} />
						</>
					)}
					{error && <p className="error">{error}</p>}
					<div className="flex justify-end gap-2">
						<button type="button" className="btn-secondary min-h-11" onClick={closeEdit}>
							Abbrechen
						</button>
						<button type="submit" className="min-h-11 self-auto!" disabled={saving || !dirty}>
							Speichern
						</button>
					</div>
				</form>
			</Modal>
		</article>
	)
}
