import type { ProductMemoryDTO } from "./categories"
import { normalizeItemName } from "./normalize"

// Produkt-Vorschläge beim Eintippen – läuft im Browser, ohne Server-Roundtrip.
// Ziel: auch mit Vertipper ("Mlch") das bekannte Produkt samt Kategorie finden.

// für den Vergleich: klein, Umlaute/ß vereinheitlicht ("Müsli" = "muesli"), Satzzeichen raus
export const foldForMatch = (value: string) =>
	normalizeItemName(value)
		.replace(/ä/g, "ae")
		.replace(/ö/g, "oe")
		.replace(/ü/g, "ue")
		.replace(/ß/g, "ss")
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/[^a-z0-9 ]/g, "")

// Damerau-Levenshtein (optimal string alignment), bricht ab, sobald max überschritten ist
export const editDistance = (a: string, b: string, max: number) => {
	if (Math.abs(a.length - b.length) > max) return max + 1
	let prevPrev: number[] = []
	let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
	for (let i = 1; i <= a.length; i++) {
		const current = [i]
		let rowMin = i
		for (let j = 1; j <= b.length; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1
			let value = Math.min(prev[j] + 1, current[j - 1] + 1, prev[j - 1] + cost)
			if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) value = Math.min(value, prevPrev[j - 2] + 1)
			current[j] = value
			rowMin = Math.min(rowMin, value)
		}
		if (rowMin > max) return max + 1
		prevPrev = prev
		prev = current
	}
	return prev[b.length]
}

const allowedTypos = (length: number) => (length <= 4 ? 1 : 2)

// 0 = Präfix, 1 = Wortanfang, 2 = enthält, 3 = Tippfehler, null = kein Treffer
export const matchRank = (query: string, candidate: string): number | null => {
	if (!query) return null
	if (candidate.startsWith(query)) return 0
	if (candidate.split(" ").some((word) => word.startsWith(query))) return 1
	if (query.length >= 3 && candidate.includes(query)) return 2
	const max = allowedTypos(query.length)
	// ganzes Wort oder gleich langer Anfang vergleichen ("joghrt" ~ "joghurt", "mlch" ~ "milch")
	const words = [candidate, ...candidate.split(" ")]
	const close = words.some(
		(word) =>
			editDistance(query, word, max) <= max ||
			(word.length > query.length && editDistance(query, word.slice(0, query.length + 1), max) <= max - (query.length <= 4 ? 0 : 1)),
	)
	return close ? 3 : null
}

// categoryId = Hauptkategorie, categoryIds = alle in Reihenfolge; via = der alternative Name, über den das Produkt gefunden wurde
export type ProductSuggestion = { displayName: string; categoryId: string | null; categoryIds: string[]; via: string | null }

export const suggestProducts = (query: string, memory: ProductMemoryDTO[], limit = 6): ProductSuggestion[] => {
	const folded = foldForMatch(query)
	if (folded.length < 2) return []

	// pro Produktname nur ein Treffer, der zuletzt benutzte; Hauptname und alternative Namen zählen gleich, der beste Treffer gilt
	const best = new Map<string, { entry: ProductMemoryDTO; rank: number; via: string | null }>()
	for (const entry of memory) {
		const key = foldForMatch(entry.displayName)
		let rank = matchRank(folded, key)
		let via: string | null = null
		for (const alias of entry.aliases ?? []) {
			const aliasRank = matchRank(folded, foldForMatch(alias))
			if (aliasRank !== null && (rank === null || aliasRank < rank)) {
				rank = aliasRank
				via = alias
			}
		}
		if (rank === null) continue
		const existing = best.get(key)
		if (!existing || entry.usedAt > existing.entry.usedAt) best.set(key, { entry, rank, via })
	}

	return [...best.values()]
		.sort((a, b) => a.rank - b.rank || b.entry.usedAt.localeCompare(a.entry.usedAt))
		.slice(0, limit)
		.map(({ entry, via }) => ({ displayName: entry.displayName, categoryId: entry.categoryIds[0] ?? null, categoryIds: entry.categoryIds, via }))
}
