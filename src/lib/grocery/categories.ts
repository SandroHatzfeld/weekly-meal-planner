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
		prisma.groceryList.findFirst({ where: { planId, id: { not: listId } }, orderBy: [{ position: "asc" }, { createdAt: "asc" }], select: { id: true } }),
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

// categoryIds in Reihenfolge: in jeder Liste gilt die erste, die dort nicht ausgeblendet ist
export type ProductMemoryDTO = { displayName: string; categoryIds: string[]; usedAt: string; aliases: string[] }

const productCategoriesSelect = { categories: { select: { categoryId: true }, orderBy: { position: "asc" as const } } }

// Name eines Produkts: der Name selbst, bei einem Alias der des zugehörigen Produkts, sonst null (unbekannt)
export const resolveProductName = async (planId: string, key: string) => {
	if (await prisma.groceryProduct.findUnique({ where: { planId_name: { planId, name: key } }, select: { name: true } })) return key
	const alias = await prisma.groceryProductAlias.findUnique({ where: { planId_name: { planId, name: key } }, select: { productName: true } })
	return alias?.productName ?? null
}

// bekannte Produkte des Plans – Grundlage für die Vorschläge beim Eintippen und die Einstellungen
export const productMemoryOfPlan = async (planId: string): Promise<ProductMemoryDTO[]> =>
	(
		await prisma.groceryProduct.findMany({
			where: { planId },
			select: { displayName: true, usedAt: true, ...productCategoriesSelect, aliases: { select: { displayName: true }, orderBy: { displayName: "asc" } } },
			orderBy: { usedAt: "desc" },
			take: 5000, // = Import-Maximum, damit ein Export immer vollständig ist
		})
	).map((entry) => ({
		displayName: entry.displayName,
		categoryIds: entry.categories.map((category) => category.categoryId),
		usedAt: entry.usedAt.toISOString(),
		aliases: entry.aliases.map((alias) => alias.displayName),
	}))

// Hauptkategorie eines Produkts (die erste)
export const recallCategory = async (planId: string, name: string) => {
	const key = await resolveProductName(planId, normalizeItemName(name))
	if (!key) return null
	const product = await prisma.groceryProduct.findUnique({ where: { planId_name: { planId, name: key } }, select: productCategoriesSelect })
	return product?.categories[0]?.categoryId ?? null
}

// Kategorien eines (bestehenden) Produkts in dieser Reihenfolge ersetzen
export const replaceProductCategories = (planId: string, productName: string, categoryIds: string[]) =>
	prisma.$transaction([
		prisma.groceryProductCategory.deleteMany({ where: { planId, productName } }),
		prisma.groceryProductCategory.createMany({
			data: [...new Set(categoryIds)].map((categoryId, position) => ({ planId, productName, categoryId, position })),
		}),
	])

// Schreibweise merken. Mit updateCategory wird categoryId zur Hauptkategorie (weitere bleiben dahinter);
// ohne Kategorie bleiben die gepflegten Kategorien unverändert. Neue Produkte übernehmen die Kategorie immer.
export const rememberProduct = async (planId: string, name: string, categoryId: string | null, updateCategory = true) => {
	const typed = normalizeItemName(name)
	if (!typed) return
	// Alternativer Name: kein neues Produkt, Zeitpunkt und Kategorie gehen auf das Hauptprodukt (Schreibweise bleibt dessen)
	const aliasOf = await prisma.groceryProductAlias.findUnique({ where: { planId_name: { planId, name: typed } }, select: { productName: true } })
	const key = aliasOf?.productName ?? typed
	const product = aliasOf
		? await prisma.groceryProduct.update({ where: { planId_name: { planId, name: key } }, data: { usedAt: new Date() }, select: productCategoriesSelect })
		: await prisma.groceryProduct.upsert({
				where: { planId_name: { planId, name: key } },
				create: { planId, name: key, displayName: name.trim() },
				update: { displayName: name.trim(), usedAt: new Date() },
				select: productCategoriesSelect,
			})
	const current = product.categories.map((category) => category.categoryId)
	if (!categoryId || current[0] === categoryId || (!updateCategory && current.length > 0)) return
	await replaceProductCategories(planId, key, [categoryId, ...current.filter((id) => id !== categoryId)])
}

// Zutaten aus Rezepten: nur noch unbekannte Produkte anlegen (ohne Kategorie). Bekannte bleiben unverändert,
// damit Schreibweise und Reihenfolge der Vorschläge nicht vom Rezept, sondern vom Einkaufen bestimmt werden.
export const rememberNewProducts = async (planId: string, names: string[]) => {
	const byKey = new Map<string, string>()
	for (const name of names) {
		const key = normalizeItemName(name)
		if (key && !byKey.has(key)) byKey.set(key, name.trim())
	}
	if (byKey.size === 0) return
	const aliases = await prisma.groceryProductAlias.findMany({ where: { planId, name: { in: [...byKey.keys()] } }, select: { name: true } })
	for (const alias of aliases) byKey.delete(alias.name)
	await prisma.groceryProduct.createMany({
		data: [...byKey].map(([name, displayName]) => ({ planId, name, displayName })),
		skipDuplicates: true,
	})
}

export const isCategoryOfPlan = async (categoryId: string, planId: string) =>
	!!(await prisma.groceryCategory.findFirst({ where: { id: categoryId, planId }, select: { id: true } }))

// Gedächtnis mit gängigen Produkten vorbefüllen (Kategorie über den Namen aus dem Vorschlagsset)
export const seedDefaultProducts = async (planId: string) => {
	const categories = await prisma.groceryCategory.findMany({ where: { planId }, select: { id: true, name: true } })
	const usedAt = new Date("2000-01-01T00:00:00Z") // älter als alles Gelernte -> eigene Einträge gehen in Vorschlägen vor
	const products = Object.entries(DEFAULT_PRODUCTS).flatMap(([category, names]) =>
		names.map((displayName) => ({
			name: normalizeItemName(displayName),
			displayName,
			categoryId: categories.find((candidate) => candidate.name === category)?.id,
		})),
	)
	await prisma.groceryProduct.createMany({
		data: products.map(({ name, displayName }) => ({ planId, name, displayName, usedAt })),
		skipDuplicates: true,
	})
	// nur Produkte ohne eigene Kategorien bekommen die Standardkategorie
	const categorized = new Set(
		(await prisma.groceryProductCategory.findMany({ where: { planId }, select: { productName: true } })).map((entry) => entry.productName),
	)
	await prisma.groceryProductCategory.createMany({
		data: products
			.filter((product) => product.categoryId && !categorized.has(product.name))
			.map((product) => ({ planId, productName: product.name, categoryId: product.categoryId!, position: 0 })),
		skipDuplicates: true,
	})
}
