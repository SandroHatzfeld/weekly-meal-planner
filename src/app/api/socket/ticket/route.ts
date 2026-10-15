import { auth } from "@/lib/auth/auth"
import { prisma } from "@/lib/prisma"
import { signTicket } from "@/lib/socket-ticket"
import { NextResponse, type NextRequest } from "next/server"

// Ticket für den Socket.io-Handshake (Plan-Room) bzw. den Presence-Room eines Dishes
export async function GET(request: NextRequest) {
	const session = await auth()
	if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
	const { id: userId, name, activePlanId } = session.user

	const dishId = request.nextUrl.searchParams.get("dishId")
	if (dishId) {
		const dish = await prisma.dish.findUnique({ where: { id: dishId }, select: { planId: true } })
		const member =
			dish && (await prisma.planMember.findUnique({ where: { userId_planId: { userId, planId: dish.planId } } }))
		if (!member) return NextResponse.json({ error: "forbidden" }, { status: 403 })
		return NextResponse.json({ ticket: signTicket({ type: "dish", userId, name: name ?? "", dishId }) })
	}

	// activePlanId wurde im jwt-Callback gerade gegen die Mitgliedschaften validiert
	if (!activePlanId) return NextResponse.json({ error: "no_plan" }, { status: 403 })
	return NextResponse.json({
		ticket: signTicket({ type: "plan", userId, name: name ?? "", planId: activePlanId }),
		planId: activePlanId,
	})
}
