import ShopList from "@/components/shop/ShopList"
import { groceryItemInclude, toGroceryItemDTO } from "@/lib/dto"
import { prisma } from "@/lib/prisma"
import { requireActivePlan } from "@/lib/session"
import { tagsOfPlan } from "@/lib/tags/queries"
import { categoriesOfPlan, categoryOrderOfPlan, productMemoryOfPlan } from "@/lib/grocery/categories"
import { listsWithDefault } from "@/lib/grocery/queries"

export default async function ShopPage({ searchParams }: PageProps<"/shop">) {
	const { planId } = await requireActivePlan()
	const { list } = await searchParams

	const { lists, defaultListId } = await listsWithDefault(planId)
	// alle Items des Plans laden – Wechsel und Verschieben zwischen Listen funktionieren dann ohne Refetch
	const items = await prisma.groceryItem.findMany({
		where: { list: { planId } },
		include: groceryItemInclude,
		orderBy: { createdAt: "asc" },
	})
	const [tags, categories, categoryOrder, productMemory] = await Promise.all([
		tagsOfPlan(planId),
		categoriesOfPlan(planId),
		categoryOrderOfPlan(planId),
		productMemoryOfPlan(planId),
	])
	// ohne ?list= mit der Standardliste aus den Plan-Einstellungen starten
	const selectedListId = lists.find((candidate) => candidate.id === list)?.id ?? defaultListId

	return (
		<ShopList
			key={lists.map((candidate) => candidate.id + candidate.name).join()}
			lists={lists}
			tags={tags}
			categories={categories}
			categoryOrder={categoryOrder}
			productMemory={productMemory}
			initialListId={selectedListId}
			initialItems={items.map(toGroceryItemDTO)}
		/>
	)
}
