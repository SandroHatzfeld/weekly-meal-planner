"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { auth, signIn } from "../auth/auth"
import { hashPassword } from "../password"
import { prisma } from "../prisma"
import { emitToPlan } from "../realtime"
import { sendVerificationMail } from "../verification"
import { findUsableInvite, joinPlanViaInvite } from "./invite"

export type FormState = { error?: string } | undefined

// eingeloggter Nutzer nimmt eine Einladung an
export const acceptInvite = async (token: string) => {
	const session = await auth()
	if (!session?.user) redirect(`/login?callbackUrl=/invite/${token}`)

	const invite = await findUsableInvite(token)
	if (!invite) redirect(`/invite/${token}`)
	if (invite.type === "PERSONAL" && invite.email !== session.user.email) redirect(`/invite/${token}`)

	await joinPlanViaInvite(invite, session.user.id)
	emitToPlan(invite.planId, "plan-changed", { planId: invite.planId })
	// Kopfzeile (Plan-Auswahl mit dem neuen Plan) nicht aus dem Browser-Cache
	revalidatePath("/", "layout")
	redirect("/")
}

// kein Account: Passwort setzen und direkt Mitglied werden
export const registerViaInvite = async (token: string, _prevState: FormState, formData: FormData): Promise<FormState> => {
	const invite = await findUsableInvite(token)
	if (!invite) return { error: "Die Einladung ist ungültig oder abgelaufen" }

	const formName = formData.get("name")
	const formPassword = formData.get("password")
	const formEmail = formData.get("email")
	if (typeof formName !== "string" || !formName.trim()) return { error: "Bitte gib einen Namen an" }
	if (typeof formPassword !== "string" || formPassword.length < 8) {
		return { error: "Das Passwort muss mindestens 8 Zeichen lang sein" }
	}
	// PERSONAL: Ziel-Email steht fest. GENERIC: Nutzer gibt sie selbst an.
	const email = invite.type === "PERSONAL" ? invite.email! : typeof formEmail === "string" ? formEmail.trim().toLowerCase() : ""
	if (!email.includes("@")) return { error: "Bitte gib eine gültige E-Mail an" }

	let user
	try {
		user = await prisma.user.create({
			data: {
				name: formName.trim(),
				email,
				passwordHash: await hashPassword(formPassword),
				// Klick auf den personalisierten Link ist der Beweis – kein separates Verify
				emailVerified: invite.type === "PERSONAL" ? new Date() : null,
			},
		})
	} catch (error) {
		if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
			return { error: "Für diese E-Mail existiert bereits ein Account – bitte einloggen" }
		}
		throw error
	}

	try {
		await joinPlanViaInvite(invite, user.id)
	} catch {
		return { error: "Die Einladung wurde bereits verwendet" }
	}
	emitToPlan(invite.planId, "plan-changed", { planId: invite.planId })

	if (invite.type === "GENERIC") {
		// Generic-Link beweist die E-Mail nicht -> Verifizierung wie bei organischer Registrierung
		await sendVerificationMail(user)
		redirect("/register/check-mail")
	}

	await signIn("credentials", { email, password: formPassword, redirectTo: "/" })
}
