import PlanRecipe from "@/components/recipes/PlanRecipe"
import { DeleteRecipeButton } from "@/components/recipes/RecipeForm"
import { todayKey } from "@/lib/dates"
import { prisma } from "@/lib/prisma"
import { resolveDefaultListId } from "@/lib/grocery/queries"
import { canViewRecipe } from "@/lib/recipes/access"
import { ingredientDetails, ingredientLabel } from "@/lib/recipes/format"
import { toTagDTO } from "@/lib/tags/icons"
import { requireActivePlan } from "@/lib/session"
import Link from "next/link"
import { notFound } from "next/navigation"

export default async function RecipePage({ params }: PageProps<"/recipes/[id]">) {
	const { id } = await params
	const { user, planId } = await requireActivePlan()

	const recipe = await prisma.recipe.findUnique({
		where: { id },
		include: { ingredients: true, user: { select: { name: true } } },
	})
	if (!recipe || !(await canViewRecipe(user.id, recipe.userId))) notFound()

	// alle Pläne des Nutzers mit ihren Listen für den Planen-Flow
	const memberships = await prisma.planMember.findMany({
		where: { userId: user.id },
		include: {
			plan: {
				include: {
					groceryLists: { select: { id: true, name: true }, orderBy: { createdAt: "asc" } },
					tags: { orderBy: { createdAt: "asc" } },
				},
			},
		},
		orderBy: { joinedAt: "asc" },
	})
	const plans = memberships.map(({ plan }) => ({
		id: plan.id,
		name: plan.name,
		lists: plan.groceryLists,
		defaultListId: resolveDefaultListId(plan.groceryLists, plan.defaultListId),
		tags: plan.tags.map(toTagDTO),
	}))
	const isOwner = recipe.userId === user.id

	return (
		<div className="grid gap-6 md:grid-cols-[2fr_1fr]">
			<article className="space-y-4">
				<div className="flex items-center gap-2">
					<Link href="/recipes" className="btn-link">
						← Rezepte
					</Link>
					{isOwner && (
						<div className="ml-auto flex gap-2">
							<Link href={`/recipes/${recipe.id}/edit`} className="btn-secondary">
								Bearbeiten
							</Link>
							<DeleteRecipeButton recipeId={recipe.id} />
						</div>
					)}
				</div>
				<h2 className="text-2xl font-semibold">{recipe.name}</h2>
				{!isOwner && <p className="text-sm opacity-60">aus dem Rezeptbuch von {recipe.user.name}</p>}
				{recipe.imageUrl && (
					// eslint-disable-next-line @next/next/no-img-element
					<img src={recipe.imageUrl} alt={recipe.name} className="max-h-72 w-full rounded object-cover" />
				)}
				{recipe.description && <p className="whitespace-pre-line">{recipe.description}</p>}
				<section>
					<h3 className="font-semibold">Zutaten</h3>
					<ul className="list-disc pl-5">
						{recipe.ingredients.map((ingredient) => (
							<li key={ingredient.id}>
								{ingredientLabel(ingredient)}
							</li>
						))}
					</ul>
				</section>
				{recipe.steps.length > 0 && (
					<section>
						<h3 className="font-semibold">Zubereitung</h3>
						<ol className="list-decimal space-y-1 pl-5">
							{recipe.steps.map((step, index) => (
								<li key={index}>{step}</li>
							))}
						</ol>
					</section>
				)}
			</article>
			<aside>
				<PlanRecipe
					recipeId={recipe.id}
					ingredients={recipe.ingredients.map((ingredient) => ({
						id: ingredient.id,
						name: ingredient.name,
						details: ingredientDetails(ingredient),
					}))}
					plans={plans}
					defaultPlanId={planId}
					defaultDate={todayKey()}
				/>
			</aside>
		</div>
	)
}
