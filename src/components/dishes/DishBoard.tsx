"use client"

import { usePlanEvent } from "@/components/realtime/SocketProvider"
import { formatDay } from "@/lib/dates"
import { createDish, moveDish } from "@/lib/dishes/actions"
import type { DishDTO } from "@/lib/dto"
import Link from "next/link"
import { useState } from "react"

type DishBoardProps = {
	planId: string
	days: string[]
	initialDishes: DishDTO[]
	mode: "week" | "month"
	monthKey?: string
	today: string
}

const upsert = (dishes: DishDTO[], dish: DishDTO) => [...dishes.filter((existing) => existing.id !== dish.id), dish]

export default function DishBoard({ planId, days, initialDishes, mode, monthKey, today }: DishBoardProps) {
	const [dishes, setDishes] = useState(initialDishes)
	const [dragId, setDragId] = useState<string | null>(null)

	// Live-Updates direkt aus dem Payload, kein Refetch
	usePlanEvent("dish-created", (dish) => setDishes((current) => upsert(current, dish)))
	usePlanEvent("dish-updated", (dish) => setDishes((current) => upsert(current, dish)))
	usePlanEvent("dish-deleted", ({ id }) => setDishes((current) => current.filter((dish) => dish.id !== id)))

	const dishesOn = (day: string) =>
		dishes.filter((dish) => dish.date === day).sort((a, b) => a.name.localeCompare(b.name))

	const handleDrop = async (day: string) => {
		const dish = dishes.find((candidate) => candidate.id === dragId)
		setDragId(null)
		if (!dish || dish.date === day) return
		setDishes((current) => upsert(current, { ...dish, date: day }))
		const updated = await moveDish(dish.id, day)
		if (updated) setDishes((current) => upsert(current, updated))
	}

	return (
		<div className={mode === "week" ? "grid gap-3 md:grid-cols-7" : "grid grid-cols-7 gap-1"}>
			{mode === "month" &&
				["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((weekday) => (
					<div key={weekday} className="text-center text-xs font-semibold opacity-60">
						{weekday}
					</div>
				))}
			{days.map((day) => (
				<div
					key={day}
					onDragOver={(event) => event.preventDefault()}
					onDrop={() => handleDrop(day)}
					className={`card flex flex-col gap-1 ${mode === "month" ? "min-h-24 p-1 text-xs" : "min-h-32"} ${day === today ? "ring-2 ring-emerald-600" : ""} ${monthKey && !day.startsWith(monthKey) ? "opacity-40" : ""}`}
				>
					<div className="font-semibold">
						{mode === "week"
							? formatDay(day, { weekday: "long", day: "2-digit", month: "2-digit" })
							: formatDay(day, { day: "numeric" })}
					</div>
					{dishesOn(day).map((dish) => (
						<Link
							key={dish.id}
							href={`/dishes/${dish.id}`}
							draggable
							onDragStart={() => setDragId(dish.id)}
							className="dish-chip"
						>
							{dish.name}
						</Link>
					))}
					{mode === "week" && <AddDish planId={planId} day={day} onCreated={(dish) => setDishes((current) => upsert(current, dish))} />}
				</div>
			))}
		</div>
	)
}

function AddDish({ planId, day, onCreated }: { planId: string; day: string; onCreated: (dish: DishDTO) => void }) {
	const [open, setOpen] = useState(false)
	const [name, setName] = useState("")

	if (!open) {
		return (
			<button type="button" className="btn-link mt-auto self-start text-sm" onClick={() => setOpen(true)}>
				+ Gericht
			</button>
		)
	}

	return (
		<form
			className="mt-auto flex flex-col gap-1"
			onSubmit={async (event) => {
				event.preventDefault()
				const dish = await createDish(planId, name, day)
				if (dish) onCreated(dish)
				setName("")
				setOpen(false)
			}}
		>
			<input autoFocus className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Name" />
			<div className="flex gap-1">
				<button type="submit" className="btn text-xs">
					Hinzufügen
				</button>
				<button type="button" className="btn-link text-xs" onClick={() => setOpen(false)}>
					Abbrechen
				</button>
			</div>
		</form>
	)
}
