import { parseDateKey } from "../dates"
import { toDishDTO } from "../dto"
import { prisma } from "../prisma"

export const dishesInRange = async (planId: string, fromKey: string, toKeyInclusive: string) => {
	const to = parseDateKey(toKeyInclusive)!
	to.setUTCDate(to.getUTCDate() + 1)
	const dishes = await prisma.dish.findMany({
		where: { planId, date: { gte: parseDateKey(fromKey)!, lt: to } },
		orderBy: [{ date: "asc" }, { name: "asc" }],
	})
	return dishes.map(toDishDTO)
}
