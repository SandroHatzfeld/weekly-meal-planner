import { authenticateToken, badRequest, isMember, notFound, unauthorized } from "@/lib/api/external-auth"
import { findItemWithPlan, setItemChecked } from "@/lib/grocery/service"
import { NextResponse } from "next/server"

// Abhaken setzt checked: true – das Item bleibt sichtbar, wird nicht gelöscht
export async function PATCH(
	request: Request,
	{ params }: RouteContext<"/api/external/lists/[listId]/grocery-items/[itemId]">,
) {
	const auth = await authenticateToken(request)
	if (!auth) return unauthorized()
	const { listId, itemId } = await params

	const item = await findItemWithPlan(itemId)
	if (!item || item.listId !== listId || !(await isMember(auth.userId, item.list.planId))) return notFound()

	const body = await request.json().catch(() => null)
	if (!body || typeof body.checked !== "boolean") return badRequest("checked must be a boolean")

	return NextResponse.json(await setItemChecked(item.list.planId, itemId, body.checked))
}
