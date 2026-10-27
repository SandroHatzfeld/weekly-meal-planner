"use server"

import { auth } from "../auth/auth"
import { prisma } from "../prisma"

// Einmal-Hinweise: weggeklickte werden am Nutzer gespeichert (gilt auf allen Geräten), in den Einstellungen zurücksetzbar
const KNOWN_HINTS = ["shop-basics", "month-days"]

const currentUserId = async () => {
	const session = await auth()
	if (!session?.user?.id) throw new Error("Nicht eingeloggt")
	return session.user.id
}

export const dismissHint = async (key: string) => {
	if (!KNOWN_HINTS.includes(key)) return
	const userId = await currentUserId()
	const user = await prisma.user.findUnique({ where: { id: userId }, select: { dismissedHints: true } })
	if (!user || user.dismissedHints.includes(key)) return
	await prisma.user.update({ where: { id: userId }, data: { dismissedHints: { push: key } } })
}

export const resetHints = async () => {
	const userId = await currentUserId()
	await prisma.user.update({ where: { id: userId }, data: { dismissedHints: [] } })
}
