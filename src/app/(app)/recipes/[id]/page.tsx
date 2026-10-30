import { productMemoryOfPlan } from "@/lib/grocery/categories"
import PlanRecipeButton from "@/components/recipes/PlanRecipeButton"
import Icon, { iconButtonClass } from "@/components/ui/Icon"
import { DeleteRecipeButton } from "@/components/recipes/RecipeForm"
import { todayKey } from "@/lib/dates"
import { prisma } from "@/lib/prisma"
import { resolveDefaultListId } from "@/lib/grocery/queries"
import { canViewRecipe } from "@/lib/recipes/access"
import RecipeRatingControl from "@/components/recipes/RecipeRatingControl"
import StarRating from "@/components/recipes/StarRating"
import { formatMinutes, ingredientLabel } from "@/lib/recipes/format"
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
					groceryLists: {
						select: { id: true, name: true },
						orderBy: [{ position: "asc" }, { createdAt: "asc" }],
					},
					tags: { orderBy: { createdAt: "asc" } },
					categories: { select: { id: true, name: true }, orderBy: { name: "asc" } },
				},
			},
		},
		orderBy: { joinedAt: "asc" },
	})
	const memories = await Promise.all(memberships.map(({ plan }) => productMemoryOfPlan(plan.id)))
	const plans = memberships.map(({ plan }, index) => ({
		id: plan.id,
		name: plan.name,
		lists: plan.groceryLists.map((list) => ({ id: list.id, name: list.name })),
		categories: plan.categories,
		defaultListId: resolveDefaultListId(plan.groceryLists, plan.defaultListId),
		tags: plan.tags.map(toTagDTO),
		memory: memories[index],
	}))
	const isOwner = recipe.userId === user.id
	const planProps = {
		recipe: {
			id: recipe.id,
			name: recipe.name,
			ownerName: isOwner ? null : recipe.user.name,
			ingredients: recipe.ingredients.map((ingredient) => ({ id: ingredient.id, name: ingredient.name, details: ingredient.details })),
		},
		plans,
		initialPlanId: planId,
		initialDate: todayKey(),
		today: todayKey(),
	}

	return (
		<article className="space-y-4">
			{/* klebt unter der App-Kopfzeile (Höhe kommt aus --app-header-h) */}
			<div className="sticky top-(--app-header-h) z-10 -mx-4 -mt-4 border-b border-(--border) bg-(--background)/95 px-4 py-2 backdrop-blur-md">
				<Link href="/recipes" className="btn-link text-sm">
					← Rezepte
				</Link>
				<div className="flex items-center gap-2">
					<h2 className="min-w-0 flex-1 truncate text-2xl font-semibold" title={recipe.name}>
						{recipe.name}
					</h2>
					<PlanRecipeButton {...planProps} />
					{isOwner && (
						<>
							<Link href={`/recipes/${recipe.id}/edit`} className={iconButtonClass} aria-label="Rezept bearbeiten" title="Bearbeiten">
								<Icon name="pencil" />
							</Link>
							<DeleteRecipeButton recipeId={recipe.id} />
						</>
					)}
				</div>
			</div>
			{!isOwner && <p className="text-sm opacity-60">aus dem Rezeptbuch von {recipe.user.name}</p>}
			{recipe.imageUrl && (
				// eslint-disable-next-line @next/next/no-img-element
				<img src={recipe.imageUrl} alt={recipe.name} className="max-h-72 w-full rounded object-cover" />
			)}
			{(!!recipe.minutes || !!recipe.rating || isOwner) && (
				<div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
					{!!recipe.minutes && (
						<span className="inline-flex items-center gap-1">
							<Icon name="clock" className="size-4" />
							{formatMinutes(recipe.minutes)}
						</span>
					)}
					{isOwner ? <RecipeRatingControl recipeId={recipe.id} initial={recipe.rating} /> : !!recipe.rating && <StarRating value={recipe.rating} className="size-4" />}
				</div>
			)}
			{recipe.description && <p className="whitespace-pre-line">{recipe.description}</p>}
			{/* reine Übersicht – Auswahl und Anpassung passieren im Planen-Popup */}
			<section>
				<h3 className="font-semibold">Zutaten</h3>
				<ul className="list-disc pl-5">
					{recipe.ingredients.map((ingredient) => (
						<li key={ingredient.id}>{ingredientLabel(ingredient)}</li>
					))}
				</ul>
			</section>
			{recipe.sourceUrl && (
				<p className="text-sm opacity-70">
					Quelle:{" "}
					<a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="underline">
						{new URL(recipe.sourceUrl).hostname.replace(/^www\./, "")}
					</a>
				</p>
			)}
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
			{/* nach dem Lesen nicht wieder hochscrollen müssen: dieselben Aktionen mit Text */}
			<div className="mt-8 flex flex-wrap gap-2 border-t border-(--border) pt-4">
				{isOwner && (
					<Link href={`/recipes/${recipe.id}/edit`} className="btn-secondary inline-flex min-h-11 items-center gap-2">
						<Icon name="pencil" className="size-5" />
						Bearbeiten
					</Link>
				)}
				<PlanRecipeButton {...planProps} withLabel />
				{isOwner && <DeleteRecipeButton recipeId={recipe.id} withLabel />}
			</div>
		</article>
	)
}
