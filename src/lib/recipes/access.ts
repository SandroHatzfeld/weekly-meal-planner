import { prisma } from "../prisma"

// Cross-User-Browsing: eigene Rezepte + die aller Personen, mit denen man einen Plan teilt
export const coMemberIds = async (userId: string, planId?: string) => {
	const members = await prisma.planMember.findMany({
		where: planId ? { planId } : { plan: { members: { some: { userId } } } },
		select: { userId: true },
	})
	return [...new Set([userId, ...members.map((member) => member.userId)])]
}

export const canViewRecipe = async (userId: string, recipeOwnerId: string) =>
	(await coMemberIds(userId)).includes(recipeOwnerId)
