"use server"

import { prisma } from "../prisma"
import { emitToPlan } from "../realtime"
import { requireMember } from "../session"
import * as service from "./service"

// jede Action prüft die Mitgliedschaft im Plan der betroffenen Liste/des Items

const memberOfList = async (listId: string) => {
	const list = await service.findListWithPlan(listId)
	if (!list) throw new Error("Liste nicht gefunden")
	await requireMember(list.planId)
	return list
}

const memberOfItem = async (itemId: string) => {
	const item = await service.findItemWithPlan(itemId)
	if (!item) throw new Error("Eintrag nicht gefunden")
	await requireMember(item.list.planId)
	return { ...item, planId: item.list.planId }
}

export const addGroceryItem = async (listId: string, name: string, details: string, dishId?: string) => {
	if (!name.trim()) return null
	const list = await memberOfList(listId)
	if (dishId) {
		const dish = await prisma.dish.findUnique({ where: { id: dishId }, select: { planId: true } })
		if (dish?.planId !== list.planId) throw new Error("Gericht gehört nicht zum Plan der Liste")
	}
	return service.createItem(list.planId, listId, { name: name.trim(), details: details.trim() || null, dishId })
}

export const toggleGroceryItem = async (itemId: string, checked: boolean) => {
	const item = await memberOfItem(itemId)
	return service.setItemChecked(item.planId, itemId, checked)
}

export const editGroceryItem = async (itemId: string, name: string, details: string) => {
	if (!name.trim()) return null
	const item = await memberOfItem(itemId)
	return service.updateItem(item.planId, itemId, { name: name.trim(), details: details.trim() || null })
}

export const setGroceryItemTags = async (itemId: string, tagIds: string[]) => {
	const item = await memberOfItem(itemId)
	return service.setItemTags(item.planId, itemId, tagIds)
}

export const moveGroceryItem = async (itemId: string, toListId: string) => {
	const item = await memberOfItem(itemId)
	return service.moveItem(item.planId, itemId, toListId)
}

export const deleteGroceryItem = async (itemId: string) => {
	const item = await memberOfItem(itemId)
	await service.deleteItem(item.planId, itemId)
}

export const clearCheckedItems = async (listId: string) => {
	const list = await memberOfList(listId)
	const checked = await prisma.groceryItem.findMany({ where: { listId, checked: true }, select: { id: true } })
	await prisma.groceryItem.deleteMany({ where: { listId, checked: true } })
	for (const item of checked) emitToPlan(list.planId, "grocery-item-deleted", { listId, id: item.id })
}

export const createGroceryList = async (planId: string, name: string) => {
	await requireMember(planId)
	if (!name.trim()) return null
	const list = await prisma.groceryList.create({ data: { planId, name: name.trim() } })
	emitToPlan(planId, "grocery-lists-changed", { planId })
	return { id: list.id, name: list.name }
}

export const renameGroceryList = async (listId: string, name: string) => {
	const list = await memberOfList(listId)
	if (!name.trim()) return
	await prisma.groceryList.update({ where: { id: listId }, data: { name: name.trim() } })
	emitToPlan(list.planId, "grocery-lists-changed", { planId: list.planId })
}

// Standardliste für Zutaten beim Planen (Plan-Einstellungen)
export const setDefaultGroceryList = async (planId: string, listId: string) => {
	await requireMember(planId)
	const list = await service.findListWithPlan(listId)
	if (!list || list.planId !== planId) return
	await prisma.plan.update({ where: { id: planId }, data: { defaultListId: listId } })
	emitToPlan(planId, "plan-changed", { planId })
}

// die letzte Liste eines Plans bleibt bestehen, sonst gäbe es keinen Ort für neue Items
export const deleteGroceryList = async (listId: string) => {
	const list = await memberOfList(listId)
	const count = await prisma.groceryList.count({ where: { planId: list.planId } })
	if (count <= 1) return { error: "Die letzte Liste kann nicht gelöscht werden" }
	await prisma.groceryList.delete({ where: { id: listId } })
	emitToPlan(list.planId, "grocery-lists-changed", { planId: list.planId })
	return {}
}
