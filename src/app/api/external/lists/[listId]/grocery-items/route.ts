import { authenticateToken, badRequest, isMember, notFound, unauthorized } from "@/lib/api/external-auth"
import { createItem, findListWithPlan, listItems } from "@/lib/grocery/service"
import { NextResponse } from "next/server"

type Context = RouteContext<"/api/external/lists/[listId]/grocery-items">

const authorizeList = async (request: Request, { params }: Context) => {
	const auth = await authenticateToken(request)
	if (!auth) return { response: unauthorized() }
	const { listId } = await params
	const list = await findListWithPlan(listId)
	if (!list || !(await isMember(auth.userId, list.planId))) return { response: notFound() }
	return { list }
}

export async function GET(request: Request, context: Context) {
	const { list, response } = await authorizeList(request, context)
	if (!list) return response
	return NextResponse.json(await listItems(list.id))
}

// neue Items landen immer in "Unkategorisiert" – ein Sprachbefehl hat keinen Dish-Kontext
export async function POST(request: Request, context: Context) {
	const { list, response } = await authorizeList(request, context)
	if (!list) return response

	const body = await request.json().catch(() => null)
	if (!body || typeof body.name !== "string" || !body.name.trim()) return badRequest("name is required")
	if (body.details !== undefined && body.details !== null && typeof body.details !== "string") {
		return badRequest("details must be a string")
	}

	const item = await createItem(list.planId, list.id, { name: body.name.trim(), details: body.details?.trim() })
	return NextResponse.json(item, { status: 201 })
}
