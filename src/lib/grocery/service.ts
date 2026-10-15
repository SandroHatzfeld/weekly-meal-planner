import { toGroceryItemDTO } from "../dto"
import { prisma } from "../prisma"
import { emitToPlan } from "../realtime"

// gemeinsame Logik für Web (Server Actions) und externe API (HA, Shortcuts, ...)
// Aufrufer müssen die Mitgliedschaft im Plan der Liste vorher geprüft haben.

const includeDish = { dish: { select: { name: true } } } as const

export const findListWithPlan = (listId: string) =>
	prisma.groceryList.findUnique({ where: { id: listId }, select: { id: true, planId: true } })

export const findItemWithPlan = (itemId: string) =>
	prisma.groceryItem.findUnique({ where: { id: itemId }, include: { list: { select: { planId: true } } } })

export const listItems = async (listId: string) => {
	const items = await prisma.groceryItem.findMany({
		where: { listId },
		include: includeDish,
		orderBy: { createdAt: "asc" },
	})
	return items.map(toGroceryItemDTO)
}

export const createItem = async (
	planId: string,
	listId: string,
	data: { name: string; details?: string | null; dishId?: string | null },
) => {
	const item = await prisma.groceryItem.create({
		data: { listId, name: data.name, details: data.details || null, dishId: data.dishId ?? null },
		include: includeDish,
	})
	const dto = toGroceryItemDTO(item)
	emitToPlan(planId, "grocery-item-created", dto)
	return dto
}

// letzter Stand gewinnt – Toggle ist idempotent, daher kein Lock
export const setItemChecked = async (planId: string, itemId: string, checked: boolean) => {
	const item = await prisma.groceryItem.update({
		where: { id: itemId },
		data: { checked, checkedAt: checked ? new Date() : null },
		include: includeDish,
	})
	emitToPlan(planId, "grocery-item-checked", { listId: item.listId, id: item.id, checked })
	return toGroceryItemDTO(item)
}

export const updateItem = async (planId: string, itemId: string, data: { name: string; details: string | null }) => {
	const item = await prisma.groceryItem.update({ where: { id: itemId }, data, include: includeDish })
	const dto = toGroceryItemDTO(item)
	emitToPlan(planId, "grocery-item-updated", dto)
	return dto
}

// Verschieben nur innerhalb desselben Plans, sonst würde der dishId-Bezug inkonsistent
export const moveItem = async (planId: string, itemId: string, toListId: string) => {
	const target = await findListWithPlan(toListId)
	if (!target || target.planId !== planId) throw new Error("Zielliste gehört nicht zu diesem Plan")
	const before = await prisma.groceryItem.findUniqueOrThrow({ where: { id: itemId } })
	const item = await prisma.groceryItem.update({ where: { id: itemId }, data: { listId: toListId }, include: includeDish })
	const dto = toGroceryItemDTO(item)
	emitToPlan(planId, "grocery-item-moved", { id: itemId, fromListId: before.listId, toListId, item: dto })
	return dto
}

export const deleteItem = async (planId: string, itemId: string) => {
	const item = await prisma.groceryItem.delete({ where: { id: itemId } })
	emitToPlan(planId, "grocery-item-deleted", { listId: item.listId, id: item.id })
}
