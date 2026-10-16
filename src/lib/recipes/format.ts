// "400 ml Kokosmilch" – gemeinsam genutzt von Rezeptansicht und Planen-Flows
export const ingredientLabel = (ingredient: { name: string; amount: number | null; unit: string | null }) =>
	[ingredient.amount?.toLocaleString("de-DE"), ingredient.unit, ingredient.name].filter(Boolean).join(" ")
