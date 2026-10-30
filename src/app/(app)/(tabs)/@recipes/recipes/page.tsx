import { prisma } from "@/lib/prisma"
import { coMemberIds } from "@/lib/recipes/access"
import RecipeFilters from "@/components/recipes/RecipeFilters"
import StarRating from "@/components/recipes/StarRating"
import Icon from "@/components/ui/Icon"
import { formatMinutes, tileColor } from "@/lib/recipes/format"
import { requireActivePlan } from "@/lib/session"
import Link from "next/link"

export default async function RecipesPage({ searchParams }: PageProps<"/recipes">) {
	const { user, planId } = await requireActivePlan()
	const { q, mine, maxMin, minRating, sort } = await searchParams
	const query = typeof q === "string" ? q.trim() : ""
	// Filter aus der URL: nur bekannte Werte
	const maxMinutes = [15, 30, 60].find((value) => String(value) === maxMin)
	const minStars = [3, 4, 5].find((value) => String(value) === minRating)
	const sortBy = sort === "minutes" || sort === "rating" ? sort : "name"

	// eigene Rezepte + Rezeptbücher aller Mitglieder des aktiven Plans
	const ownerIds = mine === "1" ? [user.id] : await coMemberIds(user.id, planId)
	const recipes = await prisma.recipe.findMany({
		where: {
			userId: { in: ownerIds },
			...(query && { name: { contains: query, mode: "insensitive" } }),
			// Rezepte ohne Dauer bzw. Bewertung fallen aus dem jeweiligen Filter heraus
			...(maxMinutes && { minutes: { lte: maxMinutes } }),
			...(minStars && { rating: { gte: minStars } }),
		},
		include: { user: { select: { id: true, name: true } } },
		// nicht Gesetzte stehen bei der Sortierung am Ende
		orderBy: [
			...(sortBy === "minutes" ? [{ minutes: { sort: "asc" as const, nulls: "last" as const } }] : []),
			...(sortBy === "rating" ? [{ rating: { sort: "desc" as const, nulls: "last" as const } }] : []),
			{ name: "asc" as const },
		],
	})

	return (
		<div className="space-y-4">
			<div className="flex items-center gap-2">
				<h2 className="text-xl font-semibold">Rezepte</h2>
				<Link href="/recipes/new" className="btn ml-auto">
					+ Neues Rezept
				</Link>
			</div>
			<RecipeFilters initial={{ q: query, maxMin: maxMinutes ? String(maxMinutes) : "", minRating: minStars ? String(minStars) : "", sort: sortBy, mine: mine === "1" }} />
			<ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
				{recipes.map((recipe) => (
					<li key={recipe.id}>
						<Link
							href={`/recipes/${recipe.id}`}
							className="group relative block aspect-square overflow-hidden rounded-lg border border-(--border) no-underline hover:no-underline focus-visible:ring-2 focus-visible:ring-emerald-600"
							style={{ backgroundColor: tileColor(recipe.id) }}
						>
							{recipe.imageUrl ? (
								// eslint-disable-next-line @next/next/no-img-element
								<img
									src={recipe.imageUrl}
									alt=""
									loading="lazy"
									className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-105"
								/>
							) : (
								<span aria-hidden="true" className="absolute inset-0 flex items-center justify-center pb-10 text-5xl font-semibold text-white/50">
									{recipe.name.charAt(0).toUpperCase()}
								</span>
							)}
							{/* Verlauf, damit der Text auf jedem Bild lesbar bleibt */}
							<div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent px-3 pt-8 pb-2 text-white">
								<div className="line-clamp-2 leading-tight font-semibold">{recipe.name}</div>
								{(!!recipe.minutes || !!recipe.rating) && (
									<div className="flex flex-wrap items-center gap-x-2 text-xs">
										{!!recipe.minutes && (
											<span className="inline-flex items-center gap-1 whitespace-nowrap">
												<Icon name="clock" className="size-3.5 shrink-0" />
												{formatMinutes(recipe.minutes)}
											</span>
										)}
										{!!recipe.rating && <StarRating value={recipe.rating} className="size-3.5" />}
									</div>
								)}
								<div className="truncate text-xs opacity-80">{recipe.user.id === user.id ? "Mein Rezept" : `von ${recipe.user.name}`}</div>
							</div>
						</Link>
					</li>
				))}
			</ul>
			{recipes.length === 0 && <p className="opacity-60">Noch keine Rezepte.</p>}
		</div>
	)
}
