type IngredientLike = { name: string; details: string | null }

// "400 ml Kokosmilch" – Rezeptansicht
export const ingredientLabel = (ingredient: IngredientLike) => [ingredient.details, ingredient.name].filter(Boolean).join(" ")

// gedeckte Hintergrundfarben für Rezepte ohne Bild; fest je Rezept (aus der ID), damit sie nicht springt
const TILE_COLORS = ["#7d8f69", "#a26b6b", "#6b7f99", "#a89060", "#b0745a", "#86698f", "#5f8c84", "#8c7a6b", "#9a8a4f", "#6f7f8f"]

export const tileColor = (id: string) => {
	let hash = 0
	for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
	return TILE_COLORS[hash % TILE_COLORS.length]
}

// 45 -> "45 Min.", 75 -> "1 Std. 15 Min.", 120 -> "2 Std."
export const formatMinutes = (minutes: number) => {
	const hours = Math.floor(minutes / 60)
	const rest = minutes % 60
	return hours === 0 ? `${rest} Min.` : rest === 0 ? `${hours} Std.` : `${hours} Std. ${rest} Min.`
}
