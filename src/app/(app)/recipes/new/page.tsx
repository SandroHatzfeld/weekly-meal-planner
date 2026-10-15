import RecipeForm from "@/components/recipes/RecipeForm"

export default function NewRecipePage() {
	return (
		<div className="space-y-4">
			<h2 className="text-xl font-semibold">Neues Rezept</h2>
			<RecipeForm />
		</div>
	)
}
