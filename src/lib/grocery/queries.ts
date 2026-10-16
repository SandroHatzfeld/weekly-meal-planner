import { prisma } from "../prisma"

export const listsOfPlan = (planId: string) =>
	prisma.groceryList.findMany({
		where: { planId },
		select: { id: true, name: true },
		orderBy: { createdAt: "asc" },
	})
