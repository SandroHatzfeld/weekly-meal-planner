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
					<label className="flex items-center gap-1 text-sm">
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
			<ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
				{recipes.map((recipe) => (
					<li key={recipe.id}>
						<Link href={`/recipes/${recipe.id}`} className="card block h-full hover:ring-2 hover:ring-emerald-600">
							{recipe.imageUrl && (
								// eslint-disable-next-line @next/next/no-img-element
								<img src={recipe.imageUrl} alt="" className="mb-2 h-32 w-full rounded object-cover" />
							)}
							<div className="font-semibold">{recipe.name}</div>
							<div className="text-xs opacity-60">{recipe.user.id === user.id ? "Mein Rezept" : `von ${recipe.user.name}`}</div>
						</Link>
					</li>
				))}
			</ul>
			{recipes.length === 0 && <p className="opacity-60">Noch keine Rezepte.</p>}
		</div>
	)
}
