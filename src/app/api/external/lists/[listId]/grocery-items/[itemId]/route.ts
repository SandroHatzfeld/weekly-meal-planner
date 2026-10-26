import { authenticateToken, badRequest, isMember, notFound, unauthorized } from "@/lib/api/external-auth"
import { deleteItem, findItemWithPlan, setItemChecked, updateItem } from "@/lib/grocery/service"
import { NextResponse } from "next/server"

type Context = RouteContext<"/api/external/lists/[listId]/grocery-items/[itemId]">

const authorizeItem = async (request: Request, { params }: Context) => {
	const auth = await authenticateToken(request)
	if (!auth) return { response: unauthorized() }
	const { listId, itemId } = await params
	const item = await findItemWithPlan(itemId)
	if (!item || item.listId !== listId || !(await isMember(auth.userId, item.list.planId))) return { response: notFound() }
	return { item }
}

// Ändern: name, details und/oder checked. Abhaken setzt checked: true – das Item bleibt sichtbar, wird nicht gelöscht.
export async function PATCH(request: Request, context: Context) {
	const { item, response } = await authorizeItem(request, context)
	if (!item) return response

	const body = await request.json().catch(() => null)
	if (!body || typeof body !== "object") return badRequest("body must be an object")
	const { name, details, checked } = body as Record<string, unknown>
	if (name === undefined && details === undefined && checked === undefined) return badRequest("name, details or checked is required")
	if (name !== undefined && (typeof name !== "string" || !name.trim())) return badRequest("name must be a non-empty string")
	if (details !== undefined && details !== null && typeof details !== "string") return badRequest("details must be a string")
	if (checked !== undefined && typeof checked !== "boolean") return badRequest("checked must be a boolean")

	const planId = item.list.planId
	let result = null
	if (name !== undefined || details !== undefined) {
		result = await updateItem(planId, item.id, {
			name: typeof name === "string" ? name.trim() : item.name,
			details: details === undefined ? item.details : (details as string | null)?.trim() || null,
		})
	}
	if (checked !== undefined) result = await setItemChecked(planId, item.id, checked)
	return NextResponse.json(result)
}

export async function DELETE(request: Request, context: Context) {
	const { item, response } = await authorizeItem(request, context)
	if (!item) return response
	await deleteItem(item.list.planId, item.id)
	return new NextResponse(null, { status: 204 })
}
