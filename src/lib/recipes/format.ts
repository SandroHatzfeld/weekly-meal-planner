type IngredientLike = { name: string; details: string | null }

// "400 ml Kokosmilch" – Rezeptansicht
export const ingredientLabel = (ingredient: IngredientLike) => [ingredient.details, ingredient.name].filter(Boolean).join(" ")

// 45 -> "45 Min.", 75 -> "1 Std. 15 Min.", 120 -> "2 Std."
export const formatMinutes = (minutes: number) => {
	const hours = Math.floor(minutes / 60)
	const rest = minutes % 60
	return hours === 0 ? `${rest} Min.` : rest === 0 ? `${hours} Std.` : `${hours} Std. ${rest} Min.`
}
