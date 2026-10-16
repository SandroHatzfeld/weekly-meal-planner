import { authenticateToken, isMember, notFound, unauthorized } from "@/lib/api/external-auth"
import { NextResponse } from "next/server"
import { listsOfPlan } from "@/lib/grocery/queries"

export async function GET(request: Request, { params }: RouteContext<"/api/external/plans/[planId]/lists">) {
	const auth = await authenticateToken(request)
	if (!auth) return unauthorized()
	const { planId } = await params
	if (!(await isMember(auth.userId, planId))) return notFound()

	const lists = await listsOfPlan(planId)
	return NextResponse.json(lists)
}
