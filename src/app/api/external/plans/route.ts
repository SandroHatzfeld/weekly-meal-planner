import { authenticateToken, unauthorized } from "@/lib/api/external-auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
	const auth = await authenticateToken(request)
	if (!auth) return unauthorized()

	const plans = await prisma.plan.findMany({
		where: { members: { some: { userId: auth.userId } } },
		select: { id: true, name: true },
		orderBy: { name: "asc" },
	})
	return NextResponse.json(plans)
}
