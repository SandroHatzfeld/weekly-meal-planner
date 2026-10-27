"use client"

import { usePlanEvent } from "@/components/realtime/SocketProvider"
import { formatDay } from "@/lib/dates"
import { moveDish } from "@/lib/dishes/actions"
import { useFeedback } from "@/components/ui/Feedback"
import Hint from "@/components/hints/Hints"
import type { DishDTO } from "@/lib/dto"
import type { CategoryDTO, ProductMemoryDTO } from "@/lib/grocery/categories"
import type { TagDTO } from "@/lib/tags/icons"
import Link from "next/link"
import PlanDishDialog from "./PlanDishDialog"
import { useState } from "react"

type DishBoardProps = {
	planId: string
	days: string[]
	initialDishes: DishDTO[]
	lists?: { id: string; name: string }[]
	defaultListId?: string
	tags?: TagDTO[]
	categories?: CategoryDTO[]
	productMemory?: ProductMemoryDTO[]
	mode: "week" | "month"
	monthKey?: string
	today: string
}

const upsert = (dishes: DishDTO[], dish: DishDTO) => [...dishes.filter((existing) => existing.id !== dish.id), dish]

export default function DishBoard({ planId, days, initialDishes, lists = [], defaultListId = "", tags = [], categories = [], productMemory = [], mode, monthKey, today }: DishBoardProps) {
	const [dishes, setDishes] = useState(initialDishes)
	const { attempt } = useFeedback()
	// neue Daten vom Server (z.B. nach dem Zurückkehren in die App) übernehmen
	const [seenDishes, setSeenDishes] = useState(initialDishes)
	if (initialDishes !== seenDishes) {
		setSeenDishes(initialDishes)
		setDishes(initialDishes)
	}
	const [dragId, setDragId] = useState<string | null>(null)
	// Tag, für den das Planen-Popup offen ist
	const [planningDay, setPlanningDay] = useState<string | null>(null)
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

	const isPast = (day: string) => day < today

	const handleDrop = async (day: string) => {
		const dish = dishes.find((candidate) => candidate.id === dragId)
		setDragId(null)
		if (!dish || dish.date === day || isPast(day)) return
		setDishes((current) => upsert(current, { ...dish, date: day }))
		const updated = await attempt(() => moveDish(dish.id, day), "Verschieben hat nicht geklappt")
		// bei einem Fehler zurück auf den alten Tag
		setDishes((current) => upsert(current, updated ?? dish))
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

	// ein Planen-Popup pro Ansicht, vorbefüllt mit dem angeklickten Tag
	const planDialog = (
		<PlanDishDialog
			open={planningDay !== null}
			onClose={() => setPlanningDay(null)}
			plans={[{ id: planId, name: "", lists, defaultListId, tags, categories, memory: productMemory }]}
			initialPlanId={planId}
			initialDate={planningDay ?? today}
			today={today}
			onPlanned={(dish) => setDishes((current) => upsert(current, dish))}
		/>
	)

	// Woche: vertikale Liste, ein Tag pro Zeile
	if (mode === "week") {
		return (
			<>
				<ul className="flex flex-col gap-2">
					{days.map((day) => (
						<li
							key={day}
							// auf vergangene Tage lässt sich nichts ziehen
							onDragOver={(event) => !isPast(day) && event.preventDefault()}
							onDrop={() => handleDrop(day)}
							className={`card flex flex-col gap-2 sm:flex-row sm:items-center ${day === today ? "ring-2 ring-emerald-600" : ""} ${isPast(day) ? "opacity-60" : ""}`}
						>
							<div className="font-semibold sm:w-44 sm:shrink-0">
								{formatDay(day, { weekday: "long", day: "2-digit", month: "2-digit" })}
							</div>
							<div className="flex flex-1 flex-wrap items-center gap-2">
								{dishChips(day)}
								{!isPast(day) && <PlanButton onClick={() => setPlanningDay(day)} />}
							</div>
						</li>
					))}
				</ul>
				{planDialog}
			</>
		)
	}

	const selectedDishes = dishesOn(selectedDay)

	return (
		<div className="space-y-4">
			<Hint id="month-days" title="Monatsübersicht">
				<p>Tippe auf einen Tag, um seine Gerichte zu sehen und etwas zu planen. Punkte zeigen, wie viele Gerichte geplant sind.</p>
			</Hint>
			<div className="grid grid-cols-7 gap-1">
				{["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((weekday) => (
					<div key={weekday} className="text-center text-xs font-semibold opacity-60">
						{weekday}
					</div>
				))}
				{days.map((day) => {
					// erstes Bild der Gerichte dieses Tages als Kachel-Hintergrund
					const cover = dishesOn(day).find((dish) => dish.imageUrl)?.imageUrl
					return (
					<div
						key={day}
						onClick={() => setSelectedDay(day)}
						onDragOver={(event) => !isPast(day) && event.preventDefault()}
						onDrop={() => handleDrop(day)}
						className={`card relative isolate flex min-h-14 cursor-pointer flex-col gap-1 overflow-hidden p-1 text-xs ${day === today ? "ring-2 ring-emerald-600" : ""} ${day === selectedDay ? "bg-emerald-50 dark:bg-emerald-950" : ""} sm:min-h-24 ${monthKey && !day.startsWith(monthKey) ? "opacity-60" : isPast(day) ? "opacity-60" : ""}`}
					>
						{cover && (
							<>
								{/* eslint-disable-next-line @next/next/no-img-element */}
								<img src={cover} alt="" aria-hidden="true" className="absolute inset-0 -z-10 size-full object-cover" />
								<span className="absolute inset-0 -z-10 bg-black/50" aria-hidden="true" />
							</>
						)}
						{/* Button für Tastaturbedienung, die ganze Zelle ist zusätzlich klickbar */}
						<button
							type="button"
							className={`self-start font-semibold ${cover ? "text-white" : ""}`}
							aria-pressed={day === selectedDay}
							aria-label={formatDay(day, { weekday: "long", day: "numeric", month: "long" })}
						>
							{formatDay(day, { day: "numeric" })}
						</button>
						<div className="hidden flex-col gap-1 sm:flex">{dishChips(day)}</div>
						{/* mobil ist für Namen kein Platz: ein Punkt pro Gericht, Details in der Liste darunter */}
						<div className="flex flex-1 flex-wrap content-center items-center justify-center gap-1 sm:hidden" aria-hidden="true">
							{dishesOn(day).map((dish) => (
								<span key={dish.id} className={`size-2 rounded-full ${cover ? "bg-white" : "bg-emerald-600"}`} />
							))}
						</div>
					</div>
					)
				})}
			</div>

			{/* Gerichte des ausgewählten Tages */}
			<section className="card space-y-3" aria-live="polite">
				<div className="flex items-center justify-between gap-2">
					<h3 className="font-semibold">{formatDay(selectedDay, { weekday: "long", day: "numeric", month: "long" })}</h3>
					{!isPast(selectedDay) && <PlanButton onClick={() => setPlanningDay(selectedDay)} />}
				</div>
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
					<p className="text-sm opacity-60">{isPast(selectedDay) ? "Für diesen vergangenen Tag war nichts geplant." : "Für diesen Tag ist noch nichts geplant."}</p>
				)}
			</section>
			{planDialog}
		</div>
	)
}

function PlanButton({ onClick }: { onClick: () => void }) {
	return (
		<button type="button" className="btn-link text-sm" onClick={onClick}>
			+ Planen
		</button>
	)
}
