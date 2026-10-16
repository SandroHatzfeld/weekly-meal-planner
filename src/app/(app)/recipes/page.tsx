import { prisma } from "@/lib/prisma"
import { coMemberIds } from "@/lib/recipes/access"
import { requireActivePlan } from "@/lib/session"
import Link from "next/link"

export default async function RecipesPage({ searchParams }: PageProps<"/recipes">) {
	const { user, planId } = await requireActivePlan()
	const { q, mine } = await searchParams
	const query = typeof q === "string" ? q.trim() : ""

	// eigene Rezepte + Rezeptbücher aller Mitglieder des aktiven Plans
	const ownerIds = mine === "1" ? [user.id] : await coMemberIds(user.id, planId)
	const recipes = await prisma.recipe.findMany({
		where: { userId: { in: ownerIds }, ...(query && { name: { contains: query, mode: "insensitive" } }) },
		include: { user: { select: { id: true, name: true } } },
		orderBy: { name: "asc" },
	})

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center gap-2">
				<h2 className="text-xl font-semibold">Rezepte</h2>
				<form className="ml-auto flex gap-2">
					<input name="q" defaultValue={query} placeholder="Suchen…" className="input" />
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
