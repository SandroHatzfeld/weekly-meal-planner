"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "../prisma"
import { requireUser } from "../session"
import { generateToken, sha256 } from "../tokens"

// Rohwert wird nur einmal zurückgegeben, gespeichert wird nur der Hash
export const createApiToken = async (name: string) => {
	const user = await requireUser()
	if (!name.trim()) return { error: "Bitte gib einen Namen an" }
	const token = generateToken("wmp_")
	await prisma.apiToken.create({ data: { userId: user.id, name: name.trim(), tokenHash: sha256(token) } })
	revalidatePath("/settings")
	return { token }
}

export const deleteApiToken = async (tokenId: string) => {
	const user = await requireUser()
	await prisma.apiToken.deleteMany({ where: { id: tokenId, userId: user.id } })
	revalidatePath("/settings")
}
