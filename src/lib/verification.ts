import { prisma } from "./prisma"
import { appUrl, sendMail } from "./mail"
import { generateToken, sha256 } from "./tokens"

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000

export const sendVerificationMail = async (user: { id: string; email: string }) => {
	const token = generateToken()
	await prisma.emailVerificationToken.create({
		data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS) },
	})
	const link = appUrl(`/verify?token=${token}`)
	await sendMail({
		to: user.email,
		subject: "Bitte bestätige deine E-Mail-Adresse",
		html: `<p>Willkommen beim Weekly Meal Planner!</p><p><a href="${link}">E-Mail-Adresse bestätigen</a></p><p>Der Link ist 24 Stunden gültig.</p>`,
	})
}

// Adresse ändern: Link an die neue Adresse, erst nach dem Klick wird sie übernommen
export const sendEmailChangeMail = async (user: { id: string }, newEmail: string) => {
	const token = generateToken()
	// ältere offene Änderungen verfallen
	await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id, newEmail: { not: null } } })
	await prisma.emailVerificationToken.create({
		data: { userId: user.id, tokenHash: sha256(token), newEmail, expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS) },
	})
	const link = appUrl(`/verify?token=${token}`)
	await sendMail({
		to: newEmail,
		subject: "Bitte bestätige deine neue E-Mail-Adresse",
		html: `<p>Du möchtest deine E-Mail-Adresse beim Weekly Meal Planner ändern.</p><p><a href="${link}">Neue Adresse bestätigen</a></p><p>Der Link ist 24 Stunden gültig. Wenn du das nicht warst, ignoriere diese E-Mail.</p>`,
	})
}

// verbraucht den Token (single-use) und markiert die E-Mail als verifiziert (bei einer Änderung: übernimmt die neue Adresse)
export const consumeVerificationToken = async (token: string) => {
	const record = await prisma.emailVerificationToken.findUnique({ where: { tokenHash: sha256(token) } })
	if (!record) return null

	await prisma.emailVerificationToken.delete({ where: { id: record.id } })
	if (record.expiresAt < new Date()) return null

	if (record.newEmail) {
		// inzwischen von jemand anderem registriert: nicht übernehmen
		if (await prisma.user.findUnique({ where: { email: record.newEmail } })) return null
		return prisma.user.update({ where: { id: record.userId }, data: { email: record.newEmail, emailVerified: new Date() } })
	}
	return prisma.user.update({ where: { id: record.userId }, data: { emailVerified: new Date() } })
}
