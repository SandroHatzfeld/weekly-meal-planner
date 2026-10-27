"use client"

import { useFeedback } from "@/components/ui/Feedback"
import ImageField from "@/components/forms/ImageField"
import ItemEditDialog from "@/components/items/ItemEditDialog"
import ItemTile from "@/components/items/ItemTile"
import StepsField from "@/components/forms/StepsField"
import { usePlanEvent, useSocket } from "@/components/realtime/SocketProvider"
import { deleteDish, updateDish, type DishInput } from "@/lib/dishes/actions"
import type { DishDTO, GroceryItemDTO } from "@/lib/dto"
import { addGroceryItem, deleteGroceryItem } from "@/lib/grocery/actions"
import { sendToggle } from "@/lib/offline/toggles"
import { applyItemChanges } from "@/lib/grocery/client"
import type { CategoryDTO, ProductMemoryDTO } from "@/lib/grocery/categories"
import type { TagDTO } from "@/lib/tags/icons"
import ProductInput from "@/components/shop/ProductInput"
import TagPicker from "@/components/tags/TagPicker"
import { useProductMemory } from "@/components/shop/useProductMemory"
import { PAST_DAY_MESSAGE } from "@/lib/dates"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

type DishEditorProps = {
	initialDish: DishDTO
	initialItems: GroceryItemDTO[]
	lists: { id: string; name: string }[]
	defaultListId: string
	tags: TagDTO[]
	categories: CategoryDTO[]
	productMemory: ProductMemoryDTO[]
	sourceRecipe: { id: string; name: string } | null
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

export default function DishEditor({ initialDish, initialItems, lists, defaultListId, tags, categories, productMemory, sourceRecipe, currentUserId, today }: DishEditorProps) {
	const router = useRouter()
	const { confirm, attempt, undoable } = useFeedback()
	const [dish, setDish] = useState(initialDish)
	const [form, setForm] = useState(toInput(initialDish))
	const [dirty, setDirty] = useState(false)
	const [remoteChange, setRemoteChange] = useState<DishDTO | null>(null)
	const [conflict, setConflict] = useState<DishDTO | null>(null)
	const [message, setMessage] = useState<string | null>(null)
	const [items, setItems] = useState(initialItems)
	const [editingItem, setEditingItem] = useState<GroceryItemDTO | null>(null)
	const { memory } = useProductMemory(productMemory)
	const [saving, setSaving] = useState(false)

	const viewers = usePresence(dish.id)

	usePlanEvent("dish-updated", (updated) => {
		if (updated.id !== dish.id || updated.updatedAt === dish.updatedAt) return
		// ohne lokale Änderungen direkt übernehmen, sonst nur Hinweis anzeigen
		if (dirty) return setRemoteChange(updated)
		setDish(updated)
		setForm(toInput(updated))
	})
	usePlanEvent("dish-deleted", ({ id }) => {
		if (id === dish.id) router.push("/week")
	})
	usePlanEvent("grocery-item-created", (item) => {
		if (item.dishId === dish.id) setItems((current) => [...current.filter((existing) => existing.id !== item.id), item])
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

	const save = async (event: React.FormEvent) => {
		event.preventDefault()
		setSaving(true)
		setMessage(null)
		const result = await attempt(() => updateDish(dish.id, form, dish.updatedAt), "Speichern hat nicht geklappt")
		setSaving(false)
		if (!result) return
		if (result.ok) {
			reload(result.dish)
			setMessage("Gespeichert")
		} else if ("conflict" in result) {
			if (!result.current) return router.push("/week")
			setConflict(result.current)
		} else {
			setMessage(result.error)
		}
	}

	const others = viewers.filter((viewer) => viewer.userId !== currentUserId).map((viewer) => viewer.name)

	return (
		<div className="space-y-4">
			<div className="flex items-center gap-2">
				<Link
					href={`/week?start=${dish.date}`}
					className="btn-link"
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
				{others.length > 0 && (
					<span className="ml-auto rounded bg-amber-100 px-2 py-1 text-xs text-amber-900">
						Gerade geöffnet von: {others.join(", ")}
					</span>
				)}
			</div>

			{conflict && (
				<div className="notice">
					Das Gericht wurde inzwischen von jemand anderem geändert.
					<button type="button" className="btn ml-2" onClick={() => reload(conflict)}>
						Neu laden
					</button>
					<span className="ml-2 text-xs opacity-70">(deine ungespeicherten Änderungen gehen dabei verloren)</span>
				</div>
			)}
			{remoteChange && !conflict && (
				<div className="notice">
					Es gibt eine neuere Version dieses Gerichts.
					<button type="button" className="btn ml-2" onClick={() => reload(remoteChange)}>
						Neu laden
					</button>
				</div>
			)}

			<form onSubmit={save} className="form max-w-none">
				<label htmlFor="name">Name</label>
				<input id="name" value={form.name} onChange={(event) => update({ name: event.target.value })} required />
				<label htmlFor="date">Datum</label>
				<input
					id="date"
					type="date"
					value={form.date}
					// ein Gericht an einem vergangenen Tag bleibt bearbeitbar, ein vergangenes Datum lässt sich aber nicht neu wählen
					min={dish.date < today ? undefined : today}
					onChange={(event) => update({ date: event.target.value })}
					ref={(element) => element?.setCustomValidity(form.date < today && form.date !== dish.date ? PAST_DAY_MESSAGE : "")}
					required
				/>
				<label htmlFor="description">Beschreibung</label>
				<textarea id="description" rows={3} value={form.description} onChange={(event) => update({ description: event.target.value })} />
				<ImageField value={form.imageUrl} onChange={(imageUrl) => update({ imageUrl })} />
				{/* key: nach Neu-Laden/Speichern mit dem aktuellen Stand neu initialisieren */}
				<StepsField key={dish.updatedAt} initial={dish.steps} onChange={(steps) => update({ steps })} />
				{message && <p className="text-sm">{message}</p>}
				<div className="flex gap-2">
					<button type="submit" disabled={saving || !dirty}>
						Speichern
					</button>
					<button
						type="button"
						className="btn-danger"
						onClick={async () => {
							if (!(await confirm({ title: "Gericht löschen?", message: "Die zugehörigen Einträge auf der Einkaufsliste bleiben erhalten.", confirmLabel: "Löschen", danger: true }))) return
							await deleteDish(dish.id)
							router.push(`/week?start=${dish.date}`)
						}}
					>
						Löschen
					</button>
				</div>
			</form>

			{sourceRecipe && (
				<p className="text-sm">
					Aus Rezept: <Link href={`/recipes/${sourceRecipe.id}`}>{sourceRecipe.name}</Link>
				</p>
			)}

			<section className="card space-y-2">
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
					<p className="text-sm opacity-60">Noch keine</p>
				)}
				<AddDishItem dishId={dish.id} lists={lists} defaultListId={defaultListId} categories={categories} tags={tags} memory={memory} />
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
			</section>
		</div>
	)
}

function AddDishItem({
	dishId,
	lists,
	defaultListId,
	categories,
	tags,
	memory,
}: {
	dishId: string
	lists: { id: string; name: string }[]
	defaultListId: string
	categories: CategoryDTO[]
	tags: TagDTO[]
	memory: ProductMemoryDTO[]
}) {
	const [name, setName] = useState("")
	const [details, setDetails] = useState("")
	const [listId, setListId] = useState(defaultListId)
	// Kategorie aus einem gewählten Vorschlag; weitertippen setzt sie zurück
	const [pickedCategory, setPickedCategory] = useState<string | null>(null)
	const [newTagIds, setNewTagIds] = useState<string[]>([])
	const { attempt } = useFeedback()

	const add = async (itemName: string, categoryId: string | null) => {
		const item = await attempt(() => addGroceryItem(listId, itemName, details, dishId, categoryId, newTagIds), "Konnte nicht hinzugefügt werden")
		if (!item) return
		setName("")
		setDetails("")
		setPickedCategory(null)
		setNewTagIds([])
	}

	return (
		<form
			className="flex flex-wrap gap-2"
			onSubmit={async (event) => {
				event.preventDefault()
				await add(name, pickedCategory)
			}}
		>
			<ProductInput
				className="basis-full sm:basis-0 sm:flex-1"
				placeholder="Zutat"
				value={name}
				onChange={(value) => {
					setName(value)
					setPickedCategory(null)
				}}
				// Vorschlag gewählt: direkt hinzufügen
				onPick={(suggestion) => void add(suggestion.displayName, suggestion.categoryId)}
				memory={memory}
				categories={categories}
				dropUp
			/>
			<input className="input min-w-0 flex-1 sm:w-32 sm:flex-none" placeholder="Details (z.B. 500 g)" value={details} onChange={(event) => setDetails(event.target.value)} />
			<TagPicker tags={tags} value={newTagIds} onChange={setNewTagIds} />
			{lists.length > 1 && (
				<select
					aria-label="Liste"
					className="input w-auto"
					value={listId}
					onChange={(event) => {
						setListId(event.target.value)
					}}
				>
					{lists.map((list) => (
						<option key={list.id} value={list.id}>
							{list.name}
						</option>
					))}
				</select>
			)}
			<button type="submit" className="btn">
				Hinzufügen
			</button>
		</form>
	)
}
