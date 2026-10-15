import { prisma } from "../prisma"
import { disconnectUser, emitToPlan } from "../realtime"

// Entfernen und Verlassen laufen über denselben Mechanismus
export const removeMembership = async (planId: string, userId: string, reason: "left" | "removed") => {
	const result = await prisma.$transaction(async (tx) => {
		const membership = await tx.planMember.delete({ where: { userId_planId: { userId, planId } } })
		const remaining = await tx.planMember.findMany({ where: { planId }, orderBy: { joinedAt: "asc" } })

		// letztes Mitglied -> Plan löschen (Cascade nimmt Dishes, Listen, Items, Invites mit)
		if (remaining.length === 0) {
			await tx.plan.delete({ where: { id: planId } })
			return { planDeleted: true }
		}

		// Owner geht -> ältestes verbleibendes Mitglied wird befördert
		if (membership.role === "OWNER" && !remaining.some((member) => member.role === "OWNER")) {
			await tx.planMember.update({
				where: { userId_planId: { userId: remaining[0].userId, planId } },
				data: { role: "OWNER" },
			})
		}
		return { planDeleted: false }
	})

	// activePlanId wird beim nächsten Request im jwt-Callback automatisch auf den Fallback gesetzt
	await prisma.user.updateMany({ where: { id: userId, activePlanId: planId }, data: { activePlanId: null } })

	if (!result.planDeleted) emitToPlan(planId, "member-removed", { userId, reason })
	disconnectUser(userId)
	return result
}
