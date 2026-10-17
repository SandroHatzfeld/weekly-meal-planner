import { prisma } from "../prisma"
import { toTagDTO } from "./icons"

export const tagsOfPlan = async (planId: string) =>
	(await prisma.planTag.findMany({ where: { planId }, orderBy: { createdAt: "asc" } })).map(toTagDTO)
