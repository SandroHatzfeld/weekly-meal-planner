import RecipeWithImport from "@/components/recipes/RecipeWithImport"
import { llmConfig } from "@/lib/recipes/import/llm"
import { prisma } from "@/lib/prisma"
import { requireActivePlan } from "@/lib/session"
import { productMemoryOfPlan } from "@/lib/grocery/categories"
import { notFound } from "next/navigation"

export default async function EditRecipePage({ params }: PageProps<"/recipes/[id]/edit">) {
	const { id } = await params
	const { user, planId } = await requireActivePlan()
	const recipe = await prisma.recipe.findUnique({ where: { id }, include: { ingredients: true } })
	// nur der Owner editiert
	if (!recipe || recipe.userId !== user.id) notFound()
	// bekannte Produkte des aktiven Plans als Vorschläge für die Zutaten
	const memory = await productMemoryOfPlan(planId)

	return (
		<div className="space-y-4">
			<div className="flex items-center gap-2">
				<h2 className="text-xl font-semibold">Rezept bearbeiten</h2>
				{/* löst das Formular weiter unten aus */}
				<button type="submit" form="recipe-form" className="btn ml-auto">
					Speichern
				</button>
			</div>
			<RecipeWithImport
				importEnabled={!!llmConfig()}
				memory={memory}
				recipeId={recipe.id}
				initial={{
					name: recipe.name,
					description: recipe.description ?? "",
					imageUrl: recipe.imageUrl ?? "",
					steps: recipe.steps,
					sourceUrl: recipe.sourceUrl ?? "",
					minutes: recipe.minutes,
					rating: recipe.rating,
					ingredients: recipe.ingredients.map((ingredient) => ({
						name: ingredient.name,
						details: ingredient.details ?? "",
					})),
				}}
			/>
		</div>
	)
}
