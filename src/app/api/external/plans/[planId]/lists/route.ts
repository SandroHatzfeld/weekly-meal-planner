import { authenticateToken, isMember, notFound, unauthorized } from "@/lib/api/external-auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET(request: Request, { params }: RouteContext<"/api/external/plans/[planId]/lists">) {
	const auth = await authenticateToken(request)
	if (!auth) return unauthorized()
	const { planId } = await params
	if (!(await isMember(auth.userId, planId))) return notFound()

	const lists = await prisma.groceryList.findMany({
		where: { planId },
		select: { id: true, name: true },
		orderBy: { createdAt: "asc" },
	})
	return NextResponse.json(lists)
}
