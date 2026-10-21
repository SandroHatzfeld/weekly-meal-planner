import { prisma } from "@/lib/prisma"
import { coMemberIds } from "@/lib/recipes/access"
import StarRating from "@/components/recipes/StarRating"
import Icon from "@/components/ui/Icon"
import { formatMinutes } from "@/lib/recipes/format"
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
			<div className="flex flex-wrap items-center gap-2">
				<h2 className="text-xl font-semibold">Rezepte</h2>
				<form className="ml-auto flex flex-wrap gap-2">
					<input name="q" defaultValue={query} placeholder="Suchen…" className="input min-w-0 basis-full sm:basis-auto sm:flex-1" />
					<select name="maxMin" defaultValue={maxMinutes ? String(maxMinutes) : ""} className="input w-auto" aria-label="Höchstdauer">
						<option value="">Jede Dauer</option>
						<option value="15">bis 15 Min.</option>
						<option value="30">bis 30 Min.</option>
						<option value="60">bis 60 Min.</option>
					</select>
					<select name="minRating" defaultValue={minStars ? String(minStars) : ""} className="input w-auto" aria-label="Mindestbewertung">
						<option value="">Jede Bewertung</option>
						<option value="3">ab 3 Sterne</option>
						<option value="4">ab 4 Sterne</option>
						<option value="5">5 Sterne</option>
					</select>
					<select name="sort" defaultValue={sortBy} className="input w-auto" aria-label="Sortierung">
						<option value="name">Nach Name</option>
						<option value="minutes">Kürzeste zuerst</option>
						<option value="rating">Beste zuerst</option>
					</select>
					<label className="flex items-center gap-1 text-sm whitespace-nowrap">
						<input type="checkbox" name="mine" value="1" defaultChecked={mine === "1"} /> nur meine
					</label>
					<button type="submit" className="btn-secondary">
						Filtern
					</button>
				</form>
				<Link href="/recipes/new" className="btn">
					+ Neues Rezept
				</Link>
			</div>
			<ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
				{recipes.map((recipe) => (
					<li key={recipe.id}>
						<Link
							href={`/recipes/${recipe.id}`}
							className="group relative block aspect-square overflow-hidden rounded-lg border border-(--border) bg-emerald-100 no-underline hover:no-underline focus-visible:ring-2 focus-visible:ring-emerald-600 dark:bg-emerald-900"
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
								<span aria-hidden="true" className="absolute inset-0 flex items-center justify-center pb-10 text-5xl font-semibold text-emerald-700/40 dark:text-emerald-300/40">
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
