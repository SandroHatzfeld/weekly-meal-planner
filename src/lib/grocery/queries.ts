import { prisma } from "../prisma"

export const listsOfPlan = (planId: string) =>
	prisma.groceryList.findMany({
		where: { planId },
		select: { id: true, name: true },
		orderBy: { createdAt: "asc" },
	})

// wirksame Standardliste: in den Plan-Einstellungen gewählt, sonst die erste Liste
export const resolveDefaultListId = (lists: { id: string }[], defaultListId: string | null | undefined) =>
	lists.find((list) => list.id === defaultListId)?.id ?? lists[0]?.id ?? ""

export const listsWithDefault = async (planId: string) => {
	const [lists, plan] = await Promise.all([
		listsOfPlan(planId),
		prisma.plan.findUnique({ where: { id: planId }, select: { defaultListId: true } }),
	])
	return { lists, defaultListId: resolveDefaultListId(lists, plan?.defaultListId) }
}
