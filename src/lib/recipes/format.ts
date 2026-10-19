type IngredientLike = { name: string; details: string | null }

// "400 ml Kokosmilch" – Rezeptansicht
export const ingredientLabel = (ingredient: IngredientLike) => [ingredient.details, ingredient.name].filter(Boolean).join(" ")
