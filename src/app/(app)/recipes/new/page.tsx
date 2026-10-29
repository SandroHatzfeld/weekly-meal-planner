import RecipeWithImport from "@/components/recipes/RecipeWithImport"
import { llmConfig } from "@/lib/recipes/import/llm"
import { productMemoryOfPlan } from "@/lib/grocery/categories"
import { requireActivePlan } from "@/lib/session"

export default async function NewRecipePage() {
	const { planId } = await requireActivePlan()
	// bekannte Produkte des aktiven Plans als Vorschläge für die Zutaten
	const memory = await productMemoryOfPlan(planId)
	return (
		<div className="space-y-4">
			<h2 className="text-xl font-semibold">Neues Rezept</h2>
			<RecipeWithImport importEnabled={!!llmConfig()} memory={memory} />
		</div>
	)
}
