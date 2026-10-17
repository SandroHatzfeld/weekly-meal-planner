// Zutatenauswahl beim Planen (client-seitig): jede Zutat wird zu einem GroceryItem,
// Name/Menge/Liste/Tags lassen sich vorher pro Zutat anpassen.

export type PlanIngredient = { id: string; name: string; details: string | null }

export type IngredientEntry = PlanIngredient & {
	selected: boolean
	listId: string | null // null = Standardliste der Planung
	tagIds: string[]
}

export type PlannedItem = { name: string; details: string | null; listId: string; tagIds: string[] }

// Opt-out: alle Zutaten vorausgewählt
export const initialEntries = (ingredients: PlanIngredient[]): IngredientEntry[] =>
	ingredients.map((ingredient) => ({ ...ingredient, selected: true, listId: null, tagIds: [] }))

export const toPlannedItems = (entries: IngredientEntry[], defaultListId: string): PlannedItem[] =>
	entries
		.filter((entry) => entry.selected)
		.map((entry) => ({ name: entry.name, details: entry.details, listId: entry.listId ?? defaultListId, tagIds: entry.tagIds }))
