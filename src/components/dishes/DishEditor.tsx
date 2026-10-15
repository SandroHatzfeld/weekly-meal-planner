"use client"

import { usePlanEvent, useSocket } from "@/components/realtime/SocketProvider"
import { deleteDish, updateDish, type DishInput } from "@/lib/dishes/actions"
import type { DishDTO, GroceryItemDTO } from "@/lib/dto"
import { addGroceryItem } from "@/lib/grocery/actions"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

type DishEditorProps = {
	initialDish: DishDTO
	initialItems: GroceryItemDTO[]
	lists: { id: string; name: string }[]
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

export default function DishEditor({ initialDish, initialItems, lists, sourceRecipe, currentUserId }: DishEditorProps) {
	const router = useRouter()
	const [dish, setDish] = useState(initialDish)
	const [form, setForm] = useState(toInput(initialDish))
	const [dirty, setDirty] = useState(false)
	const [remoteChange, setRemoteChange] = useState<DishDTO | null>(null)
	const [conflict, setConflict] = useState<DishDTO | null>(null)
	const [message, setMessage] = useState<string | null>(null)
	const [items, setItems] = useState(initialItems)
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
				<label htmlFor="imageUrl">Bild-URL</label>
				<input id="imageUrl" type="url" value={form.imageUrl} onChange={(event) => update({ imageUrl: event.target.value })} />
				<label htmlFor="steps">Schritte (einer pro Zeile)</label>
				<textarea id="steps" rows={6} value={form.steps.join("\n")} onChange={(event) => update({ steps: event.target.value.split("\n") })} />
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

			{dish.imageUrl && (
				// eslint-disable-next-line @next/next/no-img-element
				<img src={dish.imageUrl} alt={dish.name} className="max-h-64 rounded object-cover" />
			)}
			{sourceRecipe && (
				<p className="text-sm">
					Aus Rezept: <Link href={`/recipes/${sourceRecipe.id}`}>{sourceRecipe.name}</Link>
				</p>
			)}

			<section className="card space-y-2">
				<h3 className="font-semibold">Zutaten auf der Einkaufsliste</h3>
				<ul className="text-sm">
					{items.map((item) => (
						<li key={item.id} className={item.checked ? "line-through opacity-60" : ""}>
							{item.name} {item.details && <span className="opacity-70">({item.details})</span>}
						</li>
					))}
					{items.length === 0 && <li className="opacity-60">Noch keine</li>}
				</ul>
				<AddDishItem dishId={dish.id} lists={lists} />
			</section>
		</div>
	)
}

function AddDishItem({ dishId, lists }: { dishId: string; lists: { id: string; name: string }[] }) {
	const [name, setName] = useState("")
	const [details, setDetails] = useState("")
	const [listId, setListId] = useState(lists[0]?.id ?? "")

	return (
		<form
			className="flex flex-wrap gap-2"
			onSubmit={async (event) => {
				event.preventDefault()
				await addGroceryItem(listId, name, details, dishId)
				setName("")
				setDetails("")
			}}
		>
			<input className="input flex-1" placeholder="Zutat" value={name} onChange={(event) => setName(event.target.value)} required />
			<input className="input w-32" placeholder="Menge" value={details} onChange={(event) => setDetails(event.target.value)} />
			{lists.length > 1 && (
				<select className="input w-auto" value={listId} onChange={(event) => setListId(event.target.value)}>
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
