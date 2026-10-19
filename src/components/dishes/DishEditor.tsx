"use client"

import ImageField from "@/components/forms/ImageField"
import ItemEditDialog from "@/components/items/ItemEditDialog"
import ItemTile from "@/components/items/ItemTile"
import StepsField from "@/components/forms/StepsField"
import { usePlanEvent, useSocket } from "@/components/realtime/SocketProvider"
import { deleteDish, updateDish, type DishInput } from "@/lib/dishes/actions"
import type { DishDTO, GroceryItemDTO } from "@/lib/dto"
import { addGroceryItem, deleteGroceryItem, toggleGroceryItem } from "@/lib/grocery/actions"
import { applyItemChanges } from "@/lib/grocery/client"
import type { CategoryDTO, ProductMemoryDTO } from "@/lib/grocery/categories"
import type { TagDTO } from "@/lib/tags/icons"
import ProductInput from "@/components/shop/ProductInput"
import { useProductMemory } from "@/components/shop/useProductMemory"
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

export default function DishEditor({ initialDish, initialItems, lists, defaultListId, tags, categories, productMemory, sourceRecipe, currentUserId }: DishEditorProps) {
	const router = useRouter()
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
		const result = await updateDish(dish.id, form, dish.updatedAt)
		setSaving(false)
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
				<Link href={`/week?start=${dish.date}`} className="btn-link">
					← Zur Woche
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
				<input id="date" type="date" value={form.date} onChange={(event) => update({ date: event.target.value })} required />
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
							if (!confirm("Gericht wirklich löschen?")) return
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
				<h3 className="font-semibold">Zutaten auf der Einkaufsliste</h3>
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
											await toggleGroceryItem(item.id, !item.checked)
										}}
										onEdit={() => setEditingItem(item)}
									/>
								</li>
							))}
					</ul>
				) : (
					<p className="text-sm opacity-60">Noch keine</p>
				)}
				<AddDishItem dishId={dish.id} lists={lists} defaultListId={defaultListId} categories={categories} memory={memory} />
				<ItemEditDialog
					item={editingItem}
					lists={lists}
					tags={tags}
					categories={categories}
					onClose={() => setEditingItem(null)}
					onSave={async (item, changes) => replaceItem(await applyItemChanges(item, changes))}
					onDelete={async (item) => {
						setItems((current) => current.filter((existing) => existing.id !== item.id))
						await deleteGroceryItem(item.id)
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
	memory,
}: {
	dishId: string
	lists: { id: string; name: string }[]
	defaultListId: string
	categories: CategoryDTO[]
	memory: ProductMemoryDTO[]
}) {
	const [name, setName] = useState("")
	const [details, setDetails] = useState("")
	const [listId, setListId] = useState(defaultListId)
	// Kategorie aus einem gewählten Vorschlag; weitertippen setzt sie zurück
	const [pickedCategory, setPickedCategory] = useState<string | null>(null)

	return (
		<form
			className="flex flex-wrap gap-2"
			onSubmit={async (event) => {
				event.preventDefault()
				await addGroceryItem(listId, name, details, dishId, pickedCategory)
				setName("")
				setDetails("")
				setPickedCategory(null)
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
				onPick={(suggestion) => {
					setName(suggestion.displayName)
					setPickedCategory(suggestion.categoryId)
				}}
				memory={memory}
				categories={categories}
			/>
			<input className="input min-w-0 flex-1 sm:w-32 sm:flex-none" placeholder="Details (z.B. 500 g)" value={details} onChange={(event) => setDetails(event.target.value)} />
			{lists.length > 1 && (
				<select
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
