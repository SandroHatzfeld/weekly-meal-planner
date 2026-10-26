import { authenticateToken, badRequest, isMember, notFound, unauthorized } from "@/lib/api/external-auth"
import { addDays, parseDateKey, todayKey } from "@/lib/dates"
import { dishesInRange } from "@/lib/dishes/queries"
import { appUrl } from "@/lib/mail"
import { NextResponse } from "next/server"

const MAX_DAYS = 366

// geplante Gerichte eines Zeitraums (z.B. für einen Kalender in Home Assistant); Standard: heute bis in 30 Tagen
export async function GET(request: Request, { params }: RouteContext<"/api/external/plans/[planId]/dishes">) {
	const auth = await authenticateToken(request)
	if (!auth) return unauthorized()
	const { planId } = await params
	if (!(await isMember(auth.userId, planId))) return notFound()

	const search = new URL(request.url).searchParams
	const from = search.get("from") ?? todayKey()
	if (!parseDateKey(from)) return badRequest("from must be a date (YYYY-MM-DD)")
	const to = search.get("to") ?? addDays(from, 30)
	if (!parseDateKey(to)) return badRequest("to must be a date (YYYY-MM-DD)")
	if (to < from) return badRequest("to must not be before from")
	if (to > addDays(from, MAX_DAYS)) return badRequest(`range must not exceed ${MAX_DAYS} days`)

	const dishes = await dishesInRange(planId, from, to)
	return NextResponse.json(
		dishes.map((dish) => ({ id: dish.id, name: dish.name, date: dish.date, description: dish.description, url: appUrl(`/dishes/${dish.id}`) })),
	)
}
