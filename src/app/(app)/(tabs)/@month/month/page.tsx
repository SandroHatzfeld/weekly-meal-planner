import DishBoard from "@/components/dishes/DishBoard"
import { addDays, formatDay, startOfWeek, todayKey } from "@/lib/dates"
import { dishesInRange } from "@/lib/dishes/queries"
import { listsWithDefault } from "@/lib/grocery/queries"
import { tagsOfPlan } from "@/lib/tags/queries"
import { categoriesOfPlan, productMemoryOfPlan } from "@/lib/grocery/categories"
import { requireActivePlan } from "@/lib/session"
import Link from "next/link"

const shiftMonth = (monthKey: string, delta: number) => {
	const [year, month] = monthKey.split("-").map(Number)
	const date = new Date(Date.UTC(year, month - 1 + delta, 1))
	return date.toISOString().slice(0, 7)
}

export default async function MonthPage({ searchParams }: PageProps<"/month">) {
	const { planId } = await requireActivePlan()
	const { month } = await searchParams
	const monthKey = typeof month === "string" && /^\d{4}-\d{2}$/.test(month) ? month : todayKey().slice(0, 7)

	// Raster: Montag vor dem 1. bis Sonntag nach dem Monatsende
	const firstDay = `${monthKey}-01`
	const lastDay = addDays(`${shiftMonth(monthKey, 1)}-01`, -1)
	const gridStart = startOfWeek(firstDay)
	const gridEnd = addDays(startOfWeek(lastDay), 6)
	const days: string[] = []
	for (let day = gridStart; day <= gridEnd; day = addDays(day, 1)) days.push(day)

	const dishes = await dishesInRange(planId, gridStart, gridEnd)
	const [{ lists, defaultListId }, tags, categories, productMemory] = await Promise.all([
		listsWithDefault(planId),
		tagsOfPlan(planId),
		categoriesOfPlan(planId),
		productMemoryOfPlan(planId),
	])

	return (
		<div className="space-y-4">
			<div className="flex items-center gap-2">
				<Link className="btn-secondary" href={`/month?month=${shiftMonth(monthKey, -1)}`}>
					←
				</Link>
				<h2 className="text-xl font-semibold">{formatDay(firstDay, { month: "long", year: "numeric" })}</h2>
				<Link className="btn-secondary" href={`/month?month=${shiftMonth(monthKey, 1)}`}>
					→
				</Link>
				<Link className="btn-link ml-auto" href="/month">
					Heute
				</Link>
			</div>
			<DishBoard key={monthKey} planId={planId} days={days} initialDishes={dishes} lists={lists} defaultListId={defaultListId} tags={tags} categories={categories} productMemory={productMemory} mode="month" monthKey={monthKey} today={todayKey()} />
		</div>
	)
}
