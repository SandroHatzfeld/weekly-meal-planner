type IngredientLike = { name: string; amount: number | null; unit: string | null }

// "400 ml" – wird beim Planen zu GroceryItem.details
export const ingredientDetails = (ingredient: Omit<IngredientLike, "name">) =>
	[ingredient.amount?.toLocaleString("de-DE"), ingredient.unit].filter(Boolean).join(" ") || null

// "400 ml Kokosmilch" – gemeinsam genutzt von Rezeptansicht und Planen-Flows
export const ingredientLabel = (ingredient: IngredientLike) =>
	[ingredientDetails(ingredient), ingredient.name].filter(Boolean).join(" ")
