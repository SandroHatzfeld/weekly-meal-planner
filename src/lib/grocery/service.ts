import { groceryItemInclude, toGroceryItemDTO } from "../dto"
import { prisma } from "../prisma"
import { emitToPlan } from "../realtime"
import { isCategoryOfList, recallCategory, rememberProduct } from "./categories"

// gemeinsame Logik für Web (Server Actions) und externe API (HA, Shortcuts, ...)
// Aufrufer müssen die Mitgliedschaft im Plan der Liste vorher geprüft haben.


export const findListWithPlan = (listId: string) =>
	prisma.groceryList.findUnique({ where: { id: listId }, select: { id: true, planId: true } })

export const findItemWithPlan = (itemId: string) =>
	prisma.groceryItem.findUnique({ where: { id: itemId }, include: { list: { select: { planId: true } } } })

export const listItems = async (listId: string) => {
	const items = await prisma.groceryItem.findMany({
		where: { listId },
		include: groceryItemInclude,
		orderBy: { createdAt: "asc" },
	})
	return items.map(toGroceryItemDTO)
}

export const createItem = async (
	planId: string,
	listId: string,
	data: { name: string; details?: string | null; dishId?: string | null; categoryId?: string | null },
) => {
	// explizite Kategorie (z.B. aus einem Vorschlag) gewinnt, sonst die zuletzt gemerkte dieser Liste
	const explicit = data.categoryId && (await isCategoryOfList(data.categoryId, listId)) ? data.categoryId : null
	const categoryId = explicit ?? (await recallCategory(listId, data.name))
	const item = await prisma.groceryItem.create({
		data: { listId, name: data.name, details: data.details || null, dishId: data.dishId ?? null, categoryId },
		include: groceryItemInclude,
	})
	await rememberProduct(listId, data.name, categoryId, explicit !== null)
	const dto = toGroceryItemDTO(item)
	emitToPlan(planId, "grocery-item-created", dto)
	return dto
}

// Kategorie setzen und für dieses Produkt in der Liste merken
export const setItemCategory = async (planId: string, itemId: string, categoryId: string | null) => {
	const current = await prisma.groceryItem.findUniqueOrThrow({ where: { id: itemId } })
	if (categoryId && !(await isCategoryOfList(categoryId, current.listId))) throw new Error("Kategorie gehört nicht zur Liste")
	const item = await prisma.groceryItem.update({ where: { id: itemId }, data: { categoryId }, include: groceryItemInclude })
	await rememberProduct(item.listId, item.name, categoryId)
	const dto = toGroceryItemDTO(item)
	emitToPlan(planId, "grocery-item-updated", dto)
	return dto
}

// letzter Stand gewinnt – Toggle ist idempotent, daher kein Lock
export const setItemChecked = async (planId: string, itemId: string, checked: boolean) => {
	const item = await prisma.groceryItem.update({
		where: { id: itemId },
		data: { checked, checkedAt: checked ? new Date() : null },
		include: groceryItemInclude,
	})
	emitToPlan(planId, "grocery-item-checked", { listId: item.listId, id: item.id, checked })
	return toGroceryItemDTO(item)
}

export const updateItem = async (planId: string, itemId: string, data: { name: string; details: string | null }) => {
	const item = await prisma.groceryItem.update({ where: { id: itemId }, data, include: groceryItemInclude })
	// neue Schreibweise mit der aktuellen Kategorie merken
	await rememberProduct(item.listId, item.name, item.categoryId, item.categoryId !== null)
	const dto = toGroceryItemDTO(item)
	emitToPlan(planId, "grocery-item-updated", dto)
	return dto
}

// ersetzt die Tags eines Eintrags; nur Tags aus dem Plan des Eintrags sind erlaubt
export const setItemTags = async (planId: string, itemId: string, tagIds: string[]) => {
	const valid = await prisma.planTag.findMany({ where: { planId, id: { in: tagIds } }, select: { id: true } })
	const item = await prisma.groceryItem.update({
		where: { id: itemId },
		data: { tags: { set: valid } },
		include: groceryItemInclude,
	})
	const dto = toGroceryItemDTO(item)
	emitToPlan(planId, "grocery-item-updated", dto)
	return dto
}

// Verschieben nur innerhalb desselben Plans, sonst würde der dishId-Bezug inkonsistent
export const moveItem = async (planId: string, itemId: string, toListId: string) => {
	const target = await findListWithPlan(toListId)
	if (!target || target.planId !== planId) throw new Error("Zielliste gehört nicht zu diesem Plan")
	const before = await prisma.groceryItem.findUniqueOrThrow({ where: { id: itemId } })
	// Kategorien sind pro Liste: in der Zielliste neu einsortieren (gemerkt oder keine)
	const categoryId = await recallCategory(toListId, before.name)
	const item = await prisma.groceryItem.update({
		where: { id: itemId },
		data: { listId: toListId, categoryId },
		include: groceryItemInclude,
	})
	await rememberProduct(toListId, before.name, categoryId, false)
	const dto = toGroceryItemDTO(item)
	emitToPlan(planId, "grocery-item-moved", { id: itemId, fromListId: before.listId, toListId, item: dto })
	return dto
}

export const deleteItem = async (planId: string, itemId: string) => {
	const item = await prisma.groceryItem.delete({ where: { id: itemId } })
	emitToPlan(planId, "grocery-item-deleted", { listId: item.listId, id: item.id })
}
