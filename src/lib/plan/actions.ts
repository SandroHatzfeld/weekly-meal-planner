"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { auth } from "../auth/auth"
import { appUrl, escapeHtml, sendMail } from "../mail"
import { prisma } from "../prisma"
import { emitToPlan } from "../realtime"
import { requireMember, requireOwner } from "../session"
import { defaultCategoriesCreate, seedDefaultProducts } from "../grocery/categories"
import { DEFAULT_TAGS } from "../tags/icons"
import { generateToken } from "../tokens"
import { removeMembership } from "./membership"

const PERSONAL_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const GENERIC_INVITE_TTL_MS = 30 * 24 * 60 * 60 * 1000

export type FormState = { error?: string; success?: string } | undefined

// Onboarding und "neuer Plan" – legt direkt eine erste Einkaufsliste mit an
export const createPlan = async (_prevState: FormState, formData: FormData): Promise<FormState> => {
	const formPlanName = formData.get("planName")
	const formListName = formData.get("listName")
	const inviteEmails = formData.get("inviteEmails")

	const currentSession = await auth()
	if (!currentSession?.user) redirect("/login")
	if (typeof formPlanName !== "string" || !formPlanName.trim()) return { error: "Bitte gib einen Plan-Namen an" }
	const listName = typeof formListName === "string" && formListName.trim() ? formListName.trim() : "Einkaufsliste"

	const newPlan = await prisma.plan.create({
		data: {
			name: formPlanName.trim(),
			members: { create: { userId: currentSession.user.id, role: "OWNER" } },
			groceryLists: { create: { name: listName, categories: { create: defaultCategoriesCreate() } } },
			tags: { create: DEFAULT_TAGS },
		},
	})
	for (const list of await prisma.groceryList.findMany({ where: { planId: newPlan.id }, select: { id: true } })) {
		await seedDefaultProducts(list.id)
	}
	await prisma.user.update({ where: { id: currentSession.user.id }, data: { activePlanId: newPlan.id } })

	// optionale Einladungen aus dem Onboarding (kommagetrennt)
	if (typeof inviteEmails === "string") {
		const emails = inviteEmails
			.split(/[,;\s]+/)
			.map((email) => email.trim().toLowerCase())
			.filter((email) => email.includes("@"))
		for (const email of emails) {
			await sendPersonalInvite(newPlan.id, newPlan.name, email, currentSession.user.id, currentSession.user.name ?? "")
		}
	}

	redirect("/")
}

export const switchPlan = async (planId: string) => {
	const { user } = await requireMember(planId)
	await prisma.user.update({ where: { id: user.id }, data: { activePlanId: planId } })
	revalidatePath("/", "layout")
}

export const renamePlan = async (planId: string, name: string) => {
	await requireOwner(planId)
	if (!name.trim()) return
	await prisma.plan.update({ where: { id: planId }, data: { name: name.trim() } })
	emitToPlan(planId, "plan-changed", { planId })
	revalidatePath("/", "layout")
}

export const leavePlan = async (planId: string) => {
	const { user } = await requireMember(planId)
	await removeMembership(planId, user.id, "left")
	redirect("/")
}

export const removeMember = async (planId: string, userId: string) => {
	const { user } = await requireOwner(planId)
	if (userId === user.id) return
	await removeMembership(planId, userId, "removed")
	revalidatePath("/settings")
}

const sendPersonalInvite = async (
	planId: string,
	planName: string,
	email: string,
	invitedBy: string,
	inviterName: string,
) => {
	const invite = await prisma.planInvite.create({
		data: {
			planId,
			type: "PERSONAL",
			email,
			token: generateToken(),
			invitedBy,
			expiresAt: new Date(Date.now() + PERSONAL_INVITE_TTL_MS),
		},
	})
	const link = appUrl(`/invite/${invite.token}`)
	await sendMail({
		to: email,
		subject: `Einladung zum Plan "${planName}"`,
		html: `<p>${escapeHtml(inviterName)} hat dich zum Plan <strong>${escapeHtml(planName)}</strong> eingeladen.</p><p><a href="${link}">Einladung annehmen</a></p><p>Der Link ist 7 Tage gültig.</p>`,
	})
}

export const invitePerson = async (planId: string, _prevState: FormState, formData: FormData): Promise<FormState> => {
	const { user } = await requireOwner(planId)
	const formEmail = formData.get("email")
	if (typeof formEmail !== "string" || !formEmail.includes("@")) return { error: "Bitte gültige E-Mail angeben" }
	const email = formEmail.trim().toLowerCase()

	const plan = await prisma.plan.findUniqueOrThrow({
		where: { id: planId },
		include: { members: { include: { user: { select: { email: true } } } } },
	})
	if (plan.members.some((member) => member.user.email === email)) return { error: "Diese Person ist bereits Mitglied" }

	await sendPersonalInvite(planId, plan.name, email, user.id, user.name ?? "")
	revalidatePath("/settings")
	return { success: `Einladung an ${email} verschickt` }
}

export const revokePersonalInvite = async (planId: string, inviteId: string) => {
	await requireOwner(planId)
	await prisma.planInvite.updateMany({
		where: { id: inviteId, planId, type: "PERSONAL", status: "PENDING" },
		data: { status: "EXPIRED" },
	})
	revalidatePath("/settings")
}

// alter Generic-Link wird REVOKED, neuer PENDING – in einer Transaktion
export const regenerateGenericInvite = async (planId: string) => {
	const { user } = await requireOwner(planId)
	try {
		await prisma.$transaction([
			prisma.planInvite.updateMany({
				where: { planId, type: "GENERIC", status: "PENDING" },
				data: { status: "REVOKED" },
			}),
			prisma.planInvite.create({
				data: {
					planId,
					type: "GENERIC",
					token: generateToken(),
					invitedBy: user.id,
					expiresAt: new Date(Date.now() + GENERIC_INVITE_TTL_MS),
				},
			}),
		])
	} catch (error) {
		// Race-Condition: paralleles Neu-Generieren verletzt den Partial Unique Index (Postgres 23505 / Prisma P2002)
		const code = error && typeof error === "object" && "code" in error ? error.code : null
		if (code !== "P2002" && code !== "23505") throw error
	}
	revalidatePath("/settings")
}
