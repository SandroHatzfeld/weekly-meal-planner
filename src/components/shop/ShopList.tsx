"use client"

import { usePlanEvent } from "@/components/realtime/SocketProvider"
import type { GroceryItemDTO } from "@/lib/dto"
import {
	addGroceryItem,
	clearCheckedItems,
	createGroceryList,
	deleteGroceryItem,
	deleteGroceryList,
	moveGroceryItem,
	renameGroceryList,
	toggleGroceryItem,
} from "@/lib/grocery/actions"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

type ShopListProps = {
	planId: string
	lists: { id: string; name: string }[]
	initialListId: string | undefined
	initialItems: GroceryItemDTO[]
}

const upsert = (items: GroceryItemDTO[], item: GroceryItemDTO) => {
	const exists = items.some((existing) => existing.id === item.id)
	return exists ? items.map((existing) => (existing.id === item.id ? item : existing)) : [...items, item]
}

export default function ShopList({ planId, lists, initialListId, initialItems }: ShopListProps) {
	const router = useRouter()
	const [items, setItems] = useState(initialItems)
	const [listId, setListId] = useState(initialListId)
	const [name, setName] = useState("")
	const [details, setDetails] = useState("")

	// Clients filtern anhand der listId im Payload selbst
	usePlanEvent("grocery-item-created", (item) => setItems((current) => upsert(current, item)))
	usePlanEvent("grocery-item-updated", (item) => setItems((current) => upsert(current, item)))
	usePlanEvent("grocery-item-moved", ({ item }) => setItems((current) => upsert(current, item)))
	usePlanEvent("grocery-item-checked", ({ id, checked }) =>
		setItems((current) => current.map((item) => (item.id === id ? { ...item, checked } : item))),
	)
	usePlanEvent("grocery-item-deleted", ({ id }) => setItems((current) => current.filter((item) => item.id !== id)))
	usePlanEvent("dish-deleted", ({ id }) =>
		setItems((current) => current.map((item) => (item.dishId === id ? { ...item, dishId: null, dishName: null } : item))),
	)
	usePlanEvent("dish-updated", (dish) =>
		setItems((current) => current.map((item) => (item.dishId === dish.id ? { ...item, dishName: dish.name } : item))),
	)

	const selectList = (id: string) => {
		setListId(id)
		router.replace(`/shop?list=${id}`, { scroll: false })
	}

	const visible = items.filter((item) => item.listId === listId)
	// Gruppierung nach Gericht, ohne Gericht = "Unkategorisiert"
	const groups = new Map<string, { title: string; items: GroceryItemDTO[] }>()
	for (const item of visible) {
		const key = item.dishId ?? ""
		if (!groups.has(key)) groups.set(key, { title: item.dishName ?? "Unkategorisiert", items: [] })
		groups.get(key)!.items.push(item)
	}
	const sortedGroups = [...groups.entries()].sort(([a], [b]) => (a === "" ? -1 : b === "" ? 1 : 0))

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
				<button
					type="button"
					className="btn-link"
					onClick={async () => {
						const listName = prompt("Name der neuen Liste")
						if (!listName) return
						const created = await createGroceryList(planId, listName)
						if (created) router.replace(`/shop?list=${created.id}`)
					}}
				>
					+ Liste
				</button>
			</div>

			{currentList && (
				<>
					<form
						className="flex flex-wrap gap-2"
						onSubmit={async (event) => {
							event.preventDefault()
							const item = await addGroceryItem(currentList.id, name, details)
							if (item) setItems((current) => upsert(current, item))
							setName("")
							setDetails("")
						}}
					>
						<input className="input basis-full sm:basis-0 sm:flex-1" placeholder="Was wird gebraucht?" value={name} onChange={(event) => setName(event.target.value)} required />
						<input className="input min-w-0 flex-1 sm:w-36 sm:flex-none" placeholder="Details (z.B. 500 g)" value={details} onChange={(event) => setDetails(event.target.value)} />
						<button type="submit" className="btn">
							Hinzufügen
						</button>
					</form>

					{sortedGroups.length === 0 && <p className="opacity-60">Die Liste ist leer.</p>}
					{sortedGroups.map(([key, group]) => (
						<section key={key || "none"} className="card">
							<h3 className="mb-2 font-semibold">
								{/* key = dishId, leer bei "Unkategorisiert" */}
								{key ? (
									<Link href={`/dishes/${key}`} className="inline-flex items-center gap-1 py-1">
										{group.title} <span aria-hidden="true">›</span>
									</Link>
								) : (
									group.title
								)}
							</h3>
							<ul className="divide-y divide-black/5 dark:divide-white/10">
								{group.items
									.sort((a, b) => Number(a.checked) - Number(b.checked))
									.map((item) => (
										<li key={item.id} className="flex items-center gap-2 py-1">
											{/* ganze Zeile antippbar, nicht nur die Checkbox */}
											<label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 py-1.5">
												<input type="checkbox" checked={item.checked} onChange={() => toggle(item)} className="size-5 shrink-0 accent-emerald-700" />
												<span className={`min-w-0 break-words ${item.checked ? "line-through opacity-50" : ""}`}>
													{item.name} {item.details && <span className="text-sm opacity-70">{item.details}</span>}
												</span>
											</label>
											{lists.length > 1 && (
												<select
													aria-label="In andere Liste verschieben"
													className="input w-auto max-w-36 shrink-0 py-2 text-sm"
													value={item.listId}
													onChange={async (event) => {
														const moved = await moveGroceryItem(item.id, event.target.value)
														setItems((current) => upsert(current, moved))
													}}
												>
													{lists.map((list) => (
														<option key={list.id} value={list.id}>
															{list.name}
														</option>
													))}
												</select>
											)}
											<button
												type="button"
												aria-label={`${item.name} löschen`}
												className="btn-link flex size-9 shrink-0 items-center justify-center"
												onClick={async () => {
													setItems((current) => current.filter((existing) => existing.id !== item.id))
													await deleteGroceryItem(item.id)
												}}
											>
												✕
											</button>
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
						<button
							type="button"
							className="btn-link"
							onClick={async () => {
								const listName = prompt("Neuer Name der Liste", currentList.name)
								if (listName) await renameGroceryList(currentList.id, listName)
								router.refresh()
							}}
						>
							Liste umbenennen
						</button>
						{lists.length > 1 && (
							<button
								type="button"
								className="btn-link text-red-600"
								onClick={async () => {
									if (!confirm(`Liste "${currentList.name}" mit allen Einträgen löschen?`)) return
									await deleteGroceryList(currentList.id)
									router.replace("/shop")
								}}
							>
								Liste löschen
							</button>
						)}
					</div>
				</>
			)}
		</div>
	)
}
