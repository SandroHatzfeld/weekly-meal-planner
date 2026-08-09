"use server"

import { auth } from "../../../auth.config"
import { prisma } from "../prisma"
import { redirect } from "next/navigation"

export const onboardUser = async (formData: FormData) => {
	const formPlanName = formData.get("planName")
	const formListName = formData.get("listName")

	const currentSession = await auth()
	if (!currentSession || !currentSession.user) {
		redirect("/login")
	}
	if (typeof formPlanName !== "string" || typeof formListName !== "string") return

	try {
		const newPlan = await prisma.plan.create({
			data: {
				name: formPlanName,
				members: { create: { userId: currentSession.user.id, role: "OWNER" } },
				groceryLists: { create: { name: formListName }},
			},
		})

		await prisma.user.update({ where: { id: currentSession.user.id }, data: { activePlanId: newPlan.id } })
	} catch (error) {
		console.log(error)
	}

	redirect("/")
}
