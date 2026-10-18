"use server"

import { prisma } from "../prisma"
import { emitToPlan } from "../realtime"
import { requireMember } from "../session"
import { appendCategoryToLists, initListCategoryOrder, isCategoryOfPlan, rememberProduct } from "./categories"
import { normalizeItemName } from "./normalize"
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

export const addGroceryItem = async (listId: string, name: string, details: string, dishId?: string, categoryId?: string | null) => {
	if (!name.trim()) return null
	const list = await memberOfList(listId)
	if (dishId) {
		const dish = await prisma.dish.findUnique({ where: { id: dishId }, select: { planId: true } })
		if (dish?.planId !== list.planId) throw new Error("Gericht gehört nicht zum Plan der Liste")
	}
	return service.createItem(list.planId, listId, { name: name.trim(), details: details.trim() || null, dishId, categoryId })
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

export const setGroceryItemCategory = async (itemId: string, categoryId: string | null) => {
	const item = await memberOfItem(itemId)
	return service.setItemCategory(item.planId, itemId, categoryId)
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
	await initListCategoryOrder(planId, list.id)
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

// --- Kategorien des Plans, Reihenfolge im Laden pro Liste ---

const memberOfCategory = async (categoryId: string) => {
	const category = await prisma.groceryCategory.findUnique({ where: { id: categoryId } })
	if (!category) throw new Error("Kategorie nicht gefunden")
	await requireMember(category.planId)
	return category
}

const nameTaken = async (planId: string, name: string, exceptId?: string) =>
	!!(await prisma.groceryCategory.findFirst({ where: { planId, name, id: exceptId ? { not: exceptId } : undefined }, select: { id: true } }))

// neue Kategorie landet in jeder Liste am Ende
export const createCategory = async (planId: string, name: string) => {
	await requireMember(planId)
	if (!name.trim()) return {}
	if (await nameTaken(planId, name.trim())) return { error: `"${name.trim()}" gibt es schon` }
	const category = await prisma.groceryCategory.create({ data: { planId, name: name.trim() } })
	await appendCategoryToLists(planId, category.id)
	emitToPlan(planId, "grocery-lists-changed", { planId })
	return {}
}

export const renameCategory = async (categoryId: string, name: string) => {
	const category = await memberOfCategory(categoryId)
	if (!name.trim()) return {}
	if (await nameTaken(category.planId, name.trim(), categoryId)) return { error: `"${name.trim()}" gibt es schon` }
	await prisma.groceryCategory.update({ where: { id: categoryId }, data: { name: name.trim() } })
	emitToPlan(category.planId, "grocery-lists-changed", { planId: category.planId })
	return {}
}

// Einträge der Kategorie landen danach in "Sonstiges" (SetNull)
export const deleteCategory = async (categoryId: string) => {
	const category = await memberOfCategory(categoryId)
	await prisma.groceryCategory.delete({ where: { id: categoryId } })
	emitToPlan(category.planId, "grocery-lists-changed", { planId: category.planId })
}

// neue Reihenfolge einer Liste nach Drag & Drop; fremde IDs werden ignoriert, fehlende hinten angehängt
export const reorderCategories = async (listId: string, orderedIds: string[]) => {
	const list = await memberOfList(listId)
	const existing = await prisma.groceryCategory.findMany({ where: { planId: list.planId }, select: { id: true } })
	const known = new Set(existing.map((category) => category.id))
	const valid = orderedIds.filter((id) => known.has(id))
	const ids = [...valid, ...existing.map((category) => category.id).filter((id) => !valid.includes(id))]
	await prisma.$transaction(
		ids.map((categoryId, position) =>
			prisma.groceryListCategory.upsert({
				where: { listId_categoryId: { listId, categoryId } },
				create: { listId, categoryId, position },
				update: { position },
			}),
		),
	)
	emitToPlan(list.planId, "grocery-lists-changed", { planId: list.planId })
}

// Kategorie in einer Liste aus- oder einblenden; Einträge darin erscheinen dort dann unter "Sonstiges"
export const setCategoryHidden = async (listId: string, categoryId: string, hidden: boolean) => {
	const list = await memberOfList(listId)
	await prisma.groceryListCategory.update({ where: { listId_categoryId: { listId, categoryId } }, data: { hidden } })
	emitToPlan(list.planId, "grocery-lists-changed", { planId: list.planId })
}

// --- bekannte Produkte des Plans (Einstellungen) ---

// Produkt anlegen oder seine Kategorie ändern; gilt für künftige Einträge und Vorschläge in allen Listen
export const setProductCategory = async (planId: string, name: string, categoryId: string | null) => {
	await requireMember(planId)
	if (!name.trim()) return
	if (categoryId && !(await isCategoryOfPlan(categoryId, planId))) throw new Error("Kategorie gehört nicht zum Plan")
	await rememberProduct(planId, name, categoryId)
	emitToPlan(planId, "grocery-lists-changed", { planId })
}

export const forgetProduct = async (planId: string, name: string) => {
	await requireMember(planId)
	await prisma.groceryProduct.deleteMany({ where: { planId, name: normalizeItemName(name) } })
	emitToPlan(planId, "grocery-lists-changed", { planId })
}
