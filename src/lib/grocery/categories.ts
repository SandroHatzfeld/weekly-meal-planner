import { prisma } from "../prisma"
import { DEFAULT_PRODUCTS } from "./defaultProducts"
import { normalizeItemName } from "./normalize"

// Vorschlagsset für neue Pläne (bestehende: Migrationen grocery_categories + plan_wide_categories)
export const DEFAULT_CATEGORIES = [
	"Obst & Gemüse",
	"Brot & Backwaren",
	"Kühlregal",
	"Fleisch & Fisch",
	"Tiefkühl",
	"Vorrat",
	"Getränke",
	"Drogerie",
]

// Kategorien gelten für den ganzen Plan; nur die Reihenfolge im Laden ist pro Liste
export type CategoryDTO = { id: string; name: string }

export const categoriesOfPlan = async (planId: string): Promise<CategoryDTO[]> =>
	(
		await prisma.groceryCategory.findMany({ where: { planId }, select: { id: true, name: true } })
	).sort((a, b) => a.name.localeCompare(b.name, "de"))

// Reihenfolge im Laden: listId -> Kategorie-IDs
export type CategoryOrder = Record<string, string[]>

export const categoryOrderOfPlan = async (planId: string): Promise<CategoryOrder> => {
	const rows = await prisma.groceryListCategory.findMany({
		where: { list: { planId } },
		select: { listId: true, categoryId: true },
		orderBy: { position: "asc" },
	})
	const order: CategoryOrder = {}
	for (const row of rows) (order[row.listId] ??= []).push(row.categoryId)
	return order
}

// pro Liste ausgeblendete Kategorien (gibt es in dem Laden nicht): listId -> Kategorie-IDs
export const hiddenCategoriesOfPlan = async (planId: string): Promise<CategoryOrder> => {
	const rows = await prisma.groceryListCategory.findMany({
		where: { list: { planId }, hidden: true },
		select: { listId: true, categoryId: true },
	})
	const hidden: CategoryOrder = {}
	for (const row of rows) (hidden[row.listId] ??= []).push(row.categoryId)
	return hidden
}

// neue Kategorie: in jeder Liste des Plans ans Ende
export const appendCategoryToLists = async (planId: string, categoryId: string) => {
	const lists = await prisma.groceryList.findMany({
		where: { planId },
		select: { id: true, _count: { select: { categoryOrder: true } } },
	})
	await prisma.groceryListCategory.createMany({
		data: lists.map((list) => ({ listId: list.id, categoryId, position: list._count.categoryOrder })),
		skipDuplicates: true,
	})
}

// neue Liste: Reihenfolge der Standardliste übernehmen, fehlende Kategorien alphabetisch dahinter
export const initListCategoryOrder = async (planId: string, listId: string) => {
	const [plan, first, categories, order] = await Promise.all([
		prisma.plan.findUnique({ where: { id: planId }, select: { defaultListId: true } }),
		// ohne gesetzte Standardliste gilt die erste Liste des Plans
		prisma.groceryList.findFirst({ where: { planId, id: { not: listId } }, orderBy: { createdAt: "asc" }, select: { id: true } }),
		categoriesOfPlan(planId),
		categoryOrderOfPlan(planId),
	])
	const templateId = plan?.defaultListId ?? first?.id
	const template = (templateId && order[templateId]) || []
	const ids = [...template, ...categories.map((category) => category.id).filter((id) => !template.includes(id))]
	await prisma.groceryListCategory.createMany({
		data: ids.map((categoryId, position) => ({ listId, categoryId, position })),
		skipDuplicates: true,
	})
}

// neuer Plan: Vorschlagsset an Kategorien (in jeder Liste in dieser Reihenfolge) + gängige Produkte
export const seedPlanGroceries = async (planId: string) => {
	for (const name of DEFAULT_CATEGORIES) {
		const category = await prisma.groceryCategory.create({ data: { planId, name } })
		await appendCategoryToLists(planId, category.id)
	}
	await seedDefaultProducts(planId)
}

export type ProductMemoryDTO = { displayName: string; categoryId: string | null; usedAt: string }

// bekannte Produkte des Plans – Grundlage für die Vorschläge beim Eintippen und die Einstellungen
export const productMemoryOfPlan = async (planId: string): Promise<ProductMemoryDTO[]> =>
	(
		await prisma.groceryProduct.findMany({
			where: { planId },
			select: { displayName: true, categoryId: true, usedAt: true },
			orderBy: { usedAt: "desc" },
			take: 2000,
		})
	).map((entry) => ({ ...entry, usedAt: entry.usedAt.toISOString() }))

// zuletzt gemerkte Kategorie eines Produkts
export const recallCategory = async (planId: string, name: string) => {
	const product = await prisma.groceryProduct.findUnique({
		where: { planId_name: { planId, name: normalizeItemName(name) } },
		select: { categoryId: true },
	})
	return product?.categoryId ?? null
}

// Schreibweise + Kategorie merken. updateCategory=false: nur Name/Zeitpunkt auffrischen, Kategorie behalten
export const rememberProduct = async (planId: string, name: string, categoryId: string | null, updateCategory = true) => {
	const key = normalizeItemName(name)
	if (!key) return
	await prisma.groceryProduct.upsert({
		where: { planId_name: { planId, name: key } },
		create: { planId, name: key, displayName: name.trim(), categoryId },
		update: { displayName: name.trim(), usedAt: new Date(), ...(updateCategory ? { categoryId } : {}) },
	})
}

export const isCategoryOfPlan = async (categoryId: string, planId: string) =>
	!!(await prisma.groceryCategory.findFirst({ where: { id: categoryId, planId }, select: { id: true } }))

// Gedächtnis mit gängigen Produkten vorbefüllen (Kategorie über den Namen aus dem Vorschlagsset)
export const seedDefaultProducts = async (planId: string) => {
	const categories = await prisma.groceryCategory.findMany({ where: { planId }, select: { id: true, name: true } })
	const usedAt = new Date("2000-01-01T00:00:00Z") // älter als alles Gelernte -> eigene Einträge gehen in Vorschlägen vor
	await prisma.groceryProduct.createMany({
		data: Object.entries(DEFAULT_PRODUCTS).flatMap(([category, products]) =>
			products.map((displayName) => ({
				planId,
				name: normalizeItemName(displayName),
				displayName,
				categoryId: categories.find((candidate) => candidate.name === category)?.id ?? null,
				usedAt,
			})),
		),
		skipDuplicates: true,
	})
}
