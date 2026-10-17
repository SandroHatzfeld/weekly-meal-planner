"use client"

import { usePlanEvent } from "@/components/realtime/SocketProvider"
import { formatDay } from "@/lib/dates"
import { moveDish } from "@/lib/dishes/actions"
import type { DishDTO } from "@/lib/dto"
import type { TagDTO } from "@/lib/tags/icons"
import Link from "next/link"
import AddDish from "./AddDish"
import { useState } from "react"

type DishBoardProps = {
	planId: string
	days: string[]
	initialDishes: DishDTO[]
	lists?: { id: string; name: string }[]
	defaultListId?: string
	tags?: TagDTO[]
	mode: "week" | "month"
	monthKey?: string
	today: string
}

const upsert = (dishes: DishDTO[], dish: DishDTO) => [...dishes.filter((existing) => existing.id !== dish.id), dish]

export default function DishBoard({ planId, days, initialDishes, lists = [], defaultListId = "", tags = [], mode, monthKey, today }: DishBoardProps) {
	const [dishes, setDishes] = useState(initialDishes)
	const [dragId, setDragId] = useState<string | null>(null)
	// Monatsansicht: heute, falls im angezeigten Monat, sonst der Erste des Monats
	const [selectedDay, setSelectedDay] = useState(() =>
		monthKey && !today.startsWith(monthKey) ? `${monthKey}-01` : today,
	)

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

	const dishChips = (day: string) =>
		dishesOn(day).map((dish) => (
			<Link
				key={dish.id}
				href={`/dishes/${dish.id}`}
				draggable
				onDragStart={() => setDragId(dish.id)}
				className="dish-chip"
			>
				{dish.name}
			</Link>
		))

	// Woche: vertikale Liste, ein Tag pro Zeile
	if (mode === "week") {
		return (
			<ul className="flex flex-col gap-2">
				{days.map((day) => (
					<li
						key={day}
						onDragOver={(event) => event.preventDefault()}
						onDrop={() => handleDrop(day)}
						className={`card flex flex-col gap-2 sm:flex-row sm:items-center ${day === today ? "ring-2 ring-emerald-600" : ""}`}
					>
						<div className="font-semibold sm:w-44 sm:shrink-0">
							{formatDay(day, { weekday: "long", day: "2-digit", month: "2-digit" })}
						</div>
						<div className="flex flex-1 flex-wrap items-center gap-2">
							{dishChips(day)}
							<AddDish planId={planId} day={day} lists={lists} defaultListId={defaultListId} tags={tags} onCreated={(dish) => setDishes((current) => upsert(current, dish))} />
						</div>
					</li>
				))}
			</ul>
		)
	}

	const selectedDishes = dishesOn(selectedDay)

	return (
		<div className="space-y-4">
			<div className="grid grid-cols-7 gap-1">
				{["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((weekday) => (
					<div key={weekday} className="text-center text-xs font-semibold opacity-60">
						{weekday}
					</div>
				))}
				{days.map((day) => (
					<div
						key={day}
						onClick={() => setSelectedDay(day)}
						onDragOver={(event) => event.preventDefault()}
						onDrop={() => handleDrop(day)}
						className={`card flex min-h-14 cursor-pointer flex-col gap-1 p-1 text-xs ${day === today ? "ring-2 ring-emerald-600" : ""} ${day === selectedDay ? "bg-emerald-50 dark:bg-emerald-950" : ""} sm:min-h-24 ${monthKey && !day.startsWith(monthKey) ? "opacity-40" : ""}`}
					>
						{/* Button für Tastaturbedienung, die ganze Zelle ist zusätzlich klickbar */}
						<button
							type="button"
							className="self-start font-semibold"
							aria-pressed={day === selectedDay}
							aria-label={formatDay(day, { weekday: "long", day: "numeric", month: "long" })}
						>
							{formatDay(day, { day: "numeric" })}
						</button>
						<div className="hidden flex-col gap-1 sm:flex">{dishChips(day)}</div>
						{/* mobil ist für Namen kein Platz: ein Punkt pro Gericht, Details in der Liste darunter */}
						<div className="flex flex-wrap gap-0.5 sm:hidden" aria-hidden="true">
							{dishesOn(day).map((dish) => (
								<span key={dish.id} className="size-1.5 rounded-full bg-emerald-600" />
							))}
						</div>
					</div>
				))}
			</div>

			{/* Gerichte des ausgewählten Tages */}
			<section className="card space-y-3" aria-live="polite">
				<h3 className="font-semibold">{formatDay(selectedDay, { weekday: "long", day: "numeric", month: "long" })}</h3>
				<AddDish
					key={selectedDay}
					planId={planId}
					day={selectedDay}
					lists={lists}
					defaultListId={defaultListId}
					tags={tags}
					divider={selectedDishes.length > 0}
					onCreated={(dish) => setDishes((current) => upsert(current, dish))}
				/>
				{selectedDishes.length > 0 ? (
					<ul className="divide-y divide-black/5 dark:divide-white/10">
						{selectedDishes.map((dish) => (
							<li key={dish.id} className="py-2">
								<Link href={`/dishes/${dish.id}`} className="font-medium">
									{dish.name}
								</Link>
								{dish.description && <p className="line-clamp-2 text-sm opacity-70">{dish.description}</p>}
							</li>
						))}
					</ul>
				) : (
					<p className="text-sm opacity-60">Für diesen Tag ist noch nichts geplant.</p>
				)}
			</section>
		</div>
	)
}
