import DishBoard from "@/components/dishes/DishBoard"
import { addDays, formatDay, parseDateKey, startOfWeek, todayKey } from "@/lib/dates"
import { dishesInRange } from "@/lib/dishes/queries"
import { requireActivePlan } from "@/lib/session"
import Link from "next/link"
import { listsWithDefault } from "@/lib/grocery/queries"
import { tagsOfPlan } from "@/lib/tags/queries"
import { categoriesOfPlan } from "@/lib/grocery/categories"

export default async function WeekPage({ searchParams }: PageProps<"/week">) {
	const { planId } = await requireActivePlan()
	const { start } = await searchParams
	const weekStart = startOfWeek(typeof start === "string" && parseDateKey(start) ? start : todayKey())
	const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
	const dishes = await dishesInRange(planId, days[0], days[6])
	// für die Zutatenauswahl, wenn ein Rezept-Vorschlag gewählt wird
	const [{ lists, defaultListId }, tags, categories] = await Promise.all([
		listsWithDefault(planId),
		tagsOfPlan(planId),
		categoriesOfPlan(planId),
	])

	return (
		<div className="space-y-4">
			<div className="flex items-center gap-2">
				<Link className="btn-secondary" href={`/week?start=${addDays(weekStart, -7)}`}>
					←
				</Link>
				<h2 className="whitespace-nowrap text-base font-semibold sm:text-xl">
					{formatDay(days[0], { day: "2-digit", month: "2-digit" })} – {formatDay(days[6], { day: "2-digit", month: "2-digit", year: "numeric" })}
				</h2>
				<Link className="btn-secondary" href={`/week?start=${addDays(weekStart, 7)}`}>
					→
				</Link>
				<Link className="btn-link ml-auto" href="/week">
					Heute
				</Link>
			</div>
			<DishBoard key={weekStart} planId={planId} days={days} initialDishes={dishes} lists={lists} defaultListId={defaultListId} tags={tags} categories={categories} mode="week" today={todayKey()} />
		</div>
	)
}
