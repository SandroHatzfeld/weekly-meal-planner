import type { CategoryDTO } from "./categories"

// Kategorien in der Laden-Reihenfolge einer Liste; ohne Eintrag (z.B. gerade angelegt) dahinter
export const orderCategories = (categories: CategoryDTO[], order: string[] = []) => {
	const rank = (id: string) => (order.includes(id) ? order.indexOf(id) : order.length)
	return [...categories].sort((a, b) => rank(a.id) - rank(b.id))
}
