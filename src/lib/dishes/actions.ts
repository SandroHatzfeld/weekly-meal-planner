"use server"

import { parseDateKey } from "../dates"
import { toDishDTO, type DishDTO } from "../dto"
import { prisma } from "../prisma"
import { emitToPlan } from "../realtime"
import { requireMember } from "../session"

const memberOfDish = async (dishId: string) => {
	const dish = await prisma.dish.findUnique({ where: { id: dishId } })
	if (!dish) throw new Error("Gericht nicht gefunden")
	await requireMember(dish.planId)
	return dish
}

export const createDish = async (planId: string, name: string, dateKey: string) => {
	await requireMember(planId)
	const date = parseDateKey(dateKey)
	if (!name.trim() || !date) return null
	const dish = toDishDTO(await prisma.dish.create({ data: { planId, name: name.trim(), date } }))
	emitToPlan(planId, "dish-created", dish)
	return dish
}

export type DishInput = {
	name: string
	description: string
	imageUrl: string
	steps: string[]
	date: string
}

export type UpdateDishResult = { ok: true; dish: DishDTO } | { ok: false; conflict: true; current: DishDTO | null } | { ok: false; error: string }

// Optimistic Lock: updatedAt vom Ladezeitpunkt muss noch übereinstimmen
export const updateDish = async (dishId: string, input: DishInput, loadedUpdatedAt: string): Promise<UpdateDishResult> => {
	const existing = await memberOfDish(dishId)
	const date = parseDateKey(input.date)
	if (!input.name.trim() || !date) return { ok: false, error: "Name und Datum sind Pflicht" }

	const { count } = await prisma.dish.updateMany({
		where: { id: dishId, updatedAt: new Date(loadedUpdatedAt) },
		data: {
			name: input.name.trim(),
			description: input.description.trim() || null,
			imageUrl: input.imageUrl.trim() || null,
			steps: input.steps.map((step) => step.trim()).filter(Boolean),
			date,
		},
	})

	if (count === 0) {
		const current = await prisma.dish.findUnique({ where: { id: dishId } })
		return { ok: false, conflict: true, current: current ? toDishDTO(current) : null }
	}

	const dish = toDishDTO(await prisma.dish.findUniqueOrThrow({ where: { id: dishId } }))
	// an den Plan-Room, damit auch Betrachter ohne offene Bearbeitung die Änderung sehen
	emitToPlan(existing.planId, "dish-updated", dish)
	return { ok: true, dish }
}

export const moveDish = async (dishId: string, dateKey: string) => {
	const existing = await memberOfDish(dishId)
	const date = parseDateKey(dateKey)
	if (!date) return null
	const dish = toDishDTO(await prisma.dish.update({ where: { id: dishId }, data: { date } }))
	emitToPlan(existing.planId, "dish-updated", dish)
	return dish
}

export const deleteDish = async (dishId: string) => {
	const existing = await memberOfDish(dishId)
	await prisma.dish.delete({ where: { id: dishId } })
	emitToPlan(existing.planId, "dish-deleted", { id: dishId })
}
