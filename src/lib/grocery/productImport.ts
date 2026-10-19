import { prisma } from "../prisma"
import { appendCategoryToLists } from "./categories"
import type { ProductRow } from "./csv"
import { normalizeItemName } from "./normalize"

export type ImportSummary = {
	total: number
	created: number
	changed: number
	deleted: number
	newCategories: string[]
	aliases: number
	// Alternativen, die übersprungen wurden (gleich einem anderen Produkt oder schon bei einem anderen vergeben)
	skippedAliases: string[]
}

const MAX_ROWS = 5000
const MAX_CATEGORIES = 10

// Produktliste des Plans durch die CSV ersetzen: neue anlegen, geänderte aktualisieren, fehlende löschen.
// Unbekannte Kategorien werden angelegt (in jeder Liste ans Ende), vorhandene bleiben unangetastet.
// apply=false: nur zählen (Vorschau für die Bestätigung)
export const importProducts = async (planId: string, rows: ProductRow[], apply: boolean): Promise<ImportSummary> => {
	if (rows.length > MAX_ROWS) throw new Error(`Höchstens ${MAX_ROWS} Produkte pro Import`)

	const existingCategories = await prisma.groceryCategory.findMany({ where: { planId }, select: { id: true, name: true } })
	const categoryIdByName = new Map(existingCategories.map((category) => [category.name.toLowerCase(), category.id]))

	// gleiche Produkte (nach Normalisierung) zusammenfassen: letzte Zeile gewinnt
	const wanted = new Map<string, ProductRow>()
	for (const row of rows) {
		const key = normalizeItemName(row.displayName)
		if (!key) continue
		const categories = [...new Map(row.categories.map((name) => [name.toLowerCase(), name.slice(0, 60)])).values()]
		wanted.set(key, { displayName: row.displayName.slice(0, 100), aliases: row.aliases, categories: categories.slice(0, MAX_CATEGORIES) })
	}
	if (wanted.size === 0) throw new Error("Keine Produkte in der Datei gefunden")

	// Alternative Namen: pro Plan eindeutig, nie gleich einem Produktnamen; bei Kollisionen gilt der erste
	const aliasOwner = new Map<string, string>()
	const aliasRows: { name: string; displayName: string; productName: string }[] = []
	const skippedAliases: string[] = []
	for (const [productKey, row] of wanted) {
		for (const alias of row.aliases) {
			const aliasKey = normalizeItemName(alias)
			if (!aliasKey || aliasKey === productKey || aliasKey.length > 60) continue
			if (wanted.has(aliasKey) || aliasOwner.has(aliasKey)) {
				skippedAliases.push(alias)
				continue
			}
			aliasOwner.set(aliasKey, productKey)
			aliasRows.push({ name: aliasKey, displayName: alias.replace(/\s+/g, " ").slice(0, 60), productName: productKey })
		}
	}
	const newCategories = [
		...new Map(
			[...wanted.values()].flatMap((row) => row.categories).filter((name) => !categoryIdByName.has(name.toLowerCase())).map((name) => [name.toLowerCase(), name]),
		).values(),
	]

	const existing = await prisma.groceryProduct.findMany({
		where: { planId },
		select: {
			name: true,
			displayName: true,
			categories: { select: { category: { select: { name: true } } }, orderBy: { position: "asc" } },
			aliases: { select: { name: true } },
		},
	})
	const existingByName = new Map(existing.map((product) => [product.name, product]))
	const signature = (categories: string[]) => categories.map((name) => name.toLowerCase()).join("\u0000")
	const aliasKeys = (productKey: string) => aliasRows.filter((alias) => alias.productName === productKey).map((alias) => alias.name).sort().join("\u0000")
	const changed = [...wanted].filter(([key, row]) => {
		const current = existingByName.get(key)
		return (
			current &&
			(current.displayName !== row.displayName ||
				signature(current.categories.map((entry) => entry.category.name)) !== signature(row.categories) ||
				current.aliases.map((alias) => alias.name).sort().join("\u0000") !== aliasKeys(key))
		)
	})
	const created = [...wanted.keys()].filter((key) => !existingByName.has(key))
	const deleted = existing.filter((product) => !wanted.has(product.name))
	const summary = { total: wanted.size, created: created.length, changed: changed.length, deleted: deleted.length, newCategories, aliases: aliasRows.length, skippedAliases }
	if (!apply) return summary

	for (const name of newCategories) {
		const category = await prisma.groceryCategory.create({ data: { planId, name } })
		await appendCategoryToLists(planId, category.id)
		categoryIdByName.set(name.toLowerCase(), category.id)
	}
	const keys = [...wanted.keys()]
	await prisma.$transaction([
		prisma.groceryProductAlias.deleteMany({ where: { planId } }),
		prisma.groceryProduct.deleteMany({ where: { planId, name: { notIn: keys } } }),
		prisma.groceryProduct.createMany({ data: created.map((key) => ({ planId, name: key, displayName: wanted.get(key)!.displayName })) }),
		...changed.map(([key, row]) => prisma.groceryProduct.update({ where: { planId_name: { planId, name: key } }, data: { displayName: row.displayName } })),
		prisma.groceryProductCategory.deleteMany({ where: { planId } }),
		prisma.groceryProductCategory.createMany({
			data: [...wanted].flatMap(([key, row]) =>
				row.categories.map((name, position) => ({ planId, productName: key, categoryId: categoryIdByName.get(name.toLowerCase())!, position })),
			),
		}),
		prisma.groceryProductAlias.createMany({ data: aliasRows.map((alias) => ({ planId, ...alias })) }),
	])
	return summary
}
