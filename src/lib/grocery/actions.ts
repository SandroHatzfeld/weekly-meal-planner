"use server"

import { prisma } from "../prisma"
import { emitToPlan } from "../realtime"
import { requireMember } from "../session"
import { appendCategoryToLists, initListCategoryOrder, replaceProductCategories } from "./categories"
import { normalizeItemName } from "./normalize"
import { parseProductCsv } from "./csv"
import { importProducts } from "./productImport"
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

export const addGroceryItem = async (listId: string, name: string, details: string, dishId?: string, categoryId?: string | null, tagIds: string[] = []) => {
	if (!name.trim()) return null
	const list = await memberOfList(listId)
	if (dishId) {
		const dish = await prisma.dish.findUnique({ where: { id: dishId }, select: { planId: true } })
		if (dish?.planId !== list.planId) throw new Error("Gericht gehört nicht zum Plan der Liste")
	}
	return service.createItem(list.planId, listId, { name: name.trim(), details: details.trim() || null, dishId, categoryId, tagIds })
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
	// neue Liste als letzter Reiter
	const position = await prisma.groceryList.count({ where: { planId } })
	const list = await prisma.groceryList.create({ data: { planId, name: name.trim(), position } })
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

// Reihenfolge der Listen (Reiter) nach Drag & Drop; fremde IDs werden ignoriert, fehlende hinten angehängt
export const reorderGroceryLists = async (planId: string, orderedIds: string[]) => {
	await requireMember(planId)
	const existing = await prisma.groceryList.findMany({ where: { planId }, select: { id: true }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] })
	const valid = orderedIds.filter((id) => existing.some((list) => list.id === id))
	const ids = [...valid, ...existing.map((list) => list.id).filter((id) => !valid.includes(id))]
	await prisma.$transaction(ids.map((id, position) => prisma.groceryList.update({ where: { id }, data: { position } })))
	emitToPlan(planId, "grocery-lists-changed", { planId })
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
	const category = await prisma.groceryCategory.create({ data: { planId, name: name.trim() }, select: { id: true, name: true } })
	await appendCategoryToLists(planId, category.id)
	emitToPlan(planId, "grocery-lists-changed", { planId })
	return { category }
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

// Produkt anlegen oder seine Kategorien setzen (Reihenfolge = Vorrang); gilt für künftige Einträge und Vorschläge
export const setProductCategories = async (planId: string, name: string, categoryIds: string[]) => {
	await requireMember(planId)
	const key = normalizeItemName(name)
	if (!key) return
	const valid = await prisma.groceryCategory.findMany({ where: { planId, id: { in: categoryIds } }, select: { id: true } })
	await prisma.groceryProduct.upsert({
		where: { planId_name: { planId, name: key } },
		create: { planId, name: key, displayName: name.trim() },
		update: {},
	})
	await replaceProductCategories(planId, key, categoryIds.filter((id) => valid.some((category) => category.id === id)))
	emitToPlan(planId, "grocery-lists-changed", { planId })
}

export type SetAliasesResult = { ok: true } | { ok: false; error: string; conflicts?: string[] }

// Alternative Namen eines Produkts setzen (ersetzt die bisherigen). Existiert ein Alias schon als eigenes Produkt, wird mit
// mergeExisting dieses Produkt (samt seinen Kategorien) gelöscht und als Alias übernommen; seine Aliase wandern mit.
export const setProductAliases = async (planId: string, productName: string, aliases: string[], mergeExisting = false): Promise<SetAliasesResult> => {
	await requireMember(planId)
	const key = normalizeItemName(productName)
	const product = await prisma.groceryProduct.findUnique({ where: { planId_name: { planId, name: key } } })
	if (!product) return { ok: false, error: "Produkt nicht gefunden" }

	const wanted = new Map<string, string>()
	for (const alias of aliases.slice(0, 60)) {
		const aliasKey = normalizeItemName(alias)
		if (aliasKey && aliasKey !== key && aliasKey.length <= 60) wanted.set(aliasKey, alias.trim().replace(/\s+/g, " "))
	}
	const keys = [...wanted.keys()]
	const [clashingProducts, clashingAliases] = await Promise.all([
		prisma.groceryProduct.findMany({ where: { planId, name: { in: keys } }, include: { aliases: true } }),
		prisma.groceryProductAlias.findMany({ where: { planId, name: { in: keys }, productName: { not: key } } }),
	])
	if (clashingAliases.length > 0) {
		const names = clashingAliases.map((alias) => `"${alias.displayName}" (${alias.productName})`).join(", ")
		return { ok: false, error: `Schon alternativer Name eines anderen Produkts: ${names}` }
	}
	if (clashingProducts.length > 0 && !mergeExisting) {
		return { ok: false, error: "Es gibt schon eigene Produkte mit diesem Namen", conflicts: clashingProducts.map((entry) => entry.displayName) }
	}
	// zusammengeführte Produkte bringen ihre eigenen Aliase mit
	for (const merged of clashingProducts) for (const alias of merged.aliases) if (alias.name !== key) wanted.set(alias.name, alias.displayName)

	await prisma.$transaction([
		prisma.groceryProductAlias.deleteMany({ where: { planId, OR: [{ productName: key }, { productName: { in: clashingProducts.map((entry) => entry.name) } }] } }),
		prisma.groceryProduct.deleteMany({ where: { planId, name: { in: clashingProducts.map((entry) => entry.name) } } }),
		prisma.groceryProductAlias.createMany({
			data: [...wanted].map(([name, displayName]) => ({ planId, name, displayName, productName: key })),
			skipDuplicates: true,
		}),
	])
	emitToPlan(planId, "grocery-lists-changed", { planId })
	return { ok: true }
}

export const forgetProduct = async (planId: string, name: string) => {
	await requireMember(planId)
	await prisma.groceryProduct.deleteMany({ where: { planId, name: normalizeItemName(name) } })
	emitToPlan(planId, "grocery-lists-changed", { planId })
}

// CSV-Import der Produkte (siehe csv.ts); apply=false liefert nur die Vorschau
export const importProductsCsv = async (planId: string, csv: string, apply: boolean) => {
	await requireMember(planId)
	if (csv.length > 2_000_000) return { error: "Datei zu groß (max. 2 MB)" }
	try {
		const summary = await importProducts(planId, parseProductCsv(csv), apply)
		if (apply) emitToPlan(planId, "grocery-lists-changed", { planId })
		return { summary }
	} catch (error) {
		return { error: error instanceof Error ? error.message : "Import fehlgeschlagen" }
	}
}
