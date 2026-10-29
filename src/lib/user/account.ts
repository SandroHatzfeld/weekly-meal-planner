"use server"

import { revalidatePath } from "next/cache"
import { auth } from "../auth/auth"
import { hashPassword, verifyPassword } from "../password"
import { prisma } from "../prisma"
import { sendEmailChangeMail } from "../verification"

// Ergebnis der Konto-Formulare: Fehlertext fürs Formular oder Erfolg
export type AccountResult = { ok: true } | { ok: false; error: string }

const currentUser = async () => {
	const session = await auth()
	if (!session?.user?.id) throw new Error("Nicht eingeloggt")
	return prisma.user.findUniqueOrThrow({ where: { id: session.user.id } })
}

export const updateName = async (name: string): Promise<AccountResult> => {
	const user = await currentUser()
	const trimmed = name.trim()
	if (!trimmed) return { ok: false, error: "Bitte einen Namen angeben" }
	if (trimmed.length > 60) return { ok: false, error: "Der Name ist zu lang" }
	await prisma.user.update({ where: { id: user.id }, data: { name: trimmed } })
	// Name erscheint in der Kopfzeile und bei den Plan-Mitgliedern
	revalidatePath("/", "layout")
	return { ok: true }
}

// neue Adresse erst nach Bestätigung per Link übernehmen; das Passwort schützt vor Änderungen an offenen Geräten
export const requestEmailChange = async (email: string, password: string): Promise<AccountResult> => {
	const user = await currentUser()
	const newEmail = email.trim().toLowerCase()
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) return { ok: false, error: "Bitte eine gültige E-Mail-Adresse angeben" }
	if (newEmail === user.email) return { ok: false, error: "Das ist bereits deine E-Mail-Adresse" }
	if (!(await verifyPassword({ plaintextPassword: password, userPasswordHash: user.passwordHash }))) return { ok: false, error: "Das Passwort ist falsch" }
	if (await prisma.user.findUnique({ where: { email: newEmail } })) return { ok: false, error: "Diese E-Mail ist bereits registriert" }
	await sendEmailChangeMail(user, newEmail)
	revalidatePath("/settings", "layout")
	return { ok: true }
}

export const cancelEmailChange = async () => {
	const user = await currentUser()
	await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id, newEmail: { not: null } } })
	revalidatePath("/settings", "layout")
}

export const changePassword = async (oldPassword: string, newPassword: string, repeat: string): Promise<AccountResult> => {
	const user = await currentUser()
	if (!(await verifyPassword({ plaintextPassword: oldPassword, userPasswordHash: user.passwordHash }))) return { ok: false, error: "Das alte Passwort ist falsch" }
	if (newPassword.length < 8) return { ok: false, error: "Das neue Passwort muss mindestens 8 Zeichen lang sein" }
	if (newPassword !== repeat) return { ok: false, error: "Die neuen Passwörter stimmen nicht überein" }
	await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(newPassword) } })
	return { ok: true }
}
