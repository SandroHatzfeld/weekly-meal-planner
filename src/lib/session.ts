import { redirect } from "next/navigation"
import { auth } from "./auth/auth"
import { prisma } from "./prisma"

export class ForbiddenError extends Error {}

// für Seiten: leitet auf Login um, wenn keine Session existiert
export const requireUser = async () => {
	const session = await auth()
	if (!session?.user?.id) redirect("/login")
	return session.user
}

// für Seiten innerhalb der App: braucht zusätzlich einen aktiven Plan
export const requireActivePlan = async () => {
	const user = await requireUser()
	if (!user.activePlanId) redirect("/onboarding")
	return { user, planId: user.activePlanId }
}

// für Server Actions: prüft die aktuelle Mitgliedschaft gegen die DB
export const requireMember = async (planId: string) => {
	const session = await auth()
	if (!session?.user?.id) throw new ForbiddenError("Nicht eingeloggt")
	const membership = await prisma.planMember.findUnique({
		where: { userId_planId: { userId: session.user.id, planId } },
	})
	if (!membership) throw new ForbiddenError("Kein Mitglied dieses Plans")
	return { user: session.user, membership }
}

export const requireOwner = async (planId: string) => {
	const result = await requireMember(planId)
	if (result.membership.role !== "OWNER") throw new ForbiddenError("Nur der Owner darf das")
	return result
}
