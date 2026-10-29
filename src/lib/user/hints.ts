"use server"

import { auth } from "../auth/auth"
import { prisma } from "../prisma"
import { KNOWN_HINTS } from "./hint-keys"

// Einmal-Hinweise: weggeklickte werden am Nutzer gespeichert (gilt auf allen Geräten), in den Einstellungen ein-/ausschaltbar

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

// eingeschaltet: alle Hinweise wieder anzeigen; ausgeschaltet: alle als gelesen markieren
export const setHintsEnabled = async (enabled: boolean) => {
	const userId = await currentUserId()
	await prisma.user.update({ where: { id: userId }, data: { dismissedHints: enabled ? [] : KNOWN_HINTS } })
}
