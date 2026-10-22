import RecipeWithImport from "@/components/recipes/RecipeWithImport"
import { llmConfig } from "@/lib/recipes/import/llm"
import { prisma } from "@/lib/prisma"
import { requireUser } from "@/lib/session"
import { notFound } from "next/navigation"

export default async function EditRecipePage({ params }: PageProps<"/recipes/[id]/edit">) {
	const { id } = await params
	const user = await requireUser()
	const recipe = await prisma.recipe.findUnique({ where: { id }, include: { ingredients: true } })
	// nur der Owner editiert
	if (!recipe || recipe.userId !== user.id) notFound()

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
