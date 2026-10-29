"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "../prisma"
import { emitToPlan } from "../realtime"
import { requireMember } from "../session"
import { isTagIcon, toTagDTO } from "./icons"

// Tags verwalten darf jedes Plan-Mitglied (wie Listen)

const memberOfTag = async (tagId: string) => {
	const tag = await prisma.planTag.findUnique({ where: { id: tagId } })
	if (!tag) throw new Error("Tag nicht gefunden")
	await requireMember(tag.planId)
	return tag
}

const changed = (planId: string) => {
	// Einkaufslisten anderer Mitglieder laden die Tag-Definitionen neu
	emitToPlan(planId, "plan-changed", { planId })
	revalidatePath("/settings", "layout")
}

export const createTag = async (planId: string, name: string, icon: string) => {
	await requireMember(planId)
	if (!name.trim() || !isTagIcon(icon)) return { error: "Bitte Name und Icon angeben" }
	const tag = await prisma.planTag.create({ data: { planId, name: name.trim(), icon } })
	changed(planId)
	return { tag: toTagDTO(tag) }
}

export const updateTag = async (tagId: string, name: string, icon: string) => {
	const tag = await memberOfTag(tagId)
	if (!name.trim() || !isTagIcon(icon)) return { error: "Bitte Name und Icon angeben" }
	await prisma.planTag.update({ where: { id: tagId }, data: { name: name.trim(), icon } })
	changed(tag.planId)
	return {}
}

// Zuordnungen zu Einträgen verschwinden per Cascade mit
export const deleteTag = async (tagId: string) => {
	const tag = await memberOfTag(tagId)
	await prisma.planTag.delete({ where: { id: tagId } })
	changed(tag.planId)
}
