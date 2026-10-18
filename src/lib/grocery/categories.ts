import { prisma } from "../prisma"
import { normalizeItemName } from "./normalize"

// Vorschlagsset für neue Listen (bestehende Listen: Migration grocery_categories)
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

export const defaultCategoriesCreate = () => DEFAULT_CATEGORIES.map((name, position) => ({ name, position }))

export type CategoryDTO = { id: string; listId: string; name: string; position: number }

export const categoriesOfPlan = async (planId: string): Promise<CategoryDTO[]> =>
	prisma.groceryCategory.findMany({
		where: { list: { planId } },
		select: { id: true, listId: true, name: true, position: true },
		orderBy: [{ listId: "asc" }, { position: "asc" }],
	})

export type ProductMemoryDTO = { listId: string; displayName: string; categoryId: string | null; usedAt: string }

// bekannte Produkte aller Listen des Plans – Grundlage für die Vorschläge beim Eintippen
export const productMemoryOfPlan = async (planId: string): Promise<ProductMemoryDTO[]> =>
	(
		await prisma.groceryCategoryMemory.findMany({
			where: { list: { planId } },
			select: { listId: true, displayName: true, categoryId: true, usedAt: true },
			orderBy: { usedAt: "desc" },
			take: 2000,
		})
	).map((entry) => ({ ...entry, usedAt: entry.usedAt.toISOString() }))

// zuletzt gemerkte Kategorie eines Produkts in dieser Liste
export const recallCategory = async (listId: string, name: string) => {
	const memory = await prisma.groceryCategoryMemory.findUnique({
		where: { listId_name: { listId, name: normalizeItemName(name) } },
		select: { categoryId: true },
	})
	return memory?.categoryId ?? null
}

// Schreibweise + Kategorie merken. updateCategory=false: nur Name/Zeitpunkt auffrischen, Kategorie behalten
export const rememberProduct = async (listId: string, name: string, categoryId: string | null, updateCategory = true) => {
	const key = normalizeItemName(name)
	if (!key) return
	await prisma.groceryCategoryMemory.upsert({
		where: { listId_name: { listId, name: key } },
		create: { listId, name: key, displayName: name.trim(), categoryId },
		update: { displayName: name.trim(), usedAt: new Date(), ...(updateCategory ? { categoryId } : {}) },
	})
}

// gehört die Kategorie zur Liste? (Kategorien sind pro Liste)
export const isCategoryOfList = async (categoryId: string, listId: string) =>
	!!(await prisma.groceryCategory.findFirst({ where: { id: categoryId, listId }, select: { id: true } }))
