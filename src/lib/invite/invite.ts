import { prisma } from "../prisma"

// lädt einen Invite und prüft, ob er noch nutzbar ist (setzt abgelaufene auf EXPIRED)
export const findUsableInvite = async (token: string) => {
	const invite = await prisma.planInvite.findUnique({ where: { token }, include: { plan: true } })
	if (!invite || invite.status !== "PENDING") return null
	if (invite.expiresAt < new Date()) {
		await prisma.planInvite.update({ where: { id: invite.id }, data: { status: "EXPIRED" } })
		return null
	}
	return invite
}

export type UsableInvite = NonNullable<Awaited<ReturnType<typeof findUsableInvite>>>

// Mitgliedschaft anlegen, Plan aktiv setzen, PERSONAL-Invite verbrauchen
export const joinPlanViaInvite = async (invite: UsableInvite, userId: string) => {
	await prisma.$transaction(async (tx) => {
		if (invite.type === "PERSONAL") {
			const consumed = await tx.planInvite.updateMany({
				where: { id: invite.id, status: "PENDING" },
				data: { status: "ACCEPTED" },
			})
			if (consumed.count === 0) throw new Error("Einladung wurde bereits verwendet")
		}
		await tx.planMember.upsert({
			where: { userId_planId: { userId, planId: invite.planId } },
			create: { userId, planId: invite.planId, role: "MEMBER" },
			update: {},
		})
		await tx.user.update({ where: { id: userId }, data: { activePlanId: invite.planId } })
	})
}
