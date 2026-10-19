import NewRecipe from "@/components/recipes/NewRecipe"
import { llmConfig } from "@/lib/recipes/import/llm"

export default function NewRecipePage() {
	return (
		<div className="space-y-4">
			<h2 className="text-xl font-semibold">Neues Rezept</h2>
			<NewRecipe importEnabled={!!llmConfig()} />
		</div>
	)
}
