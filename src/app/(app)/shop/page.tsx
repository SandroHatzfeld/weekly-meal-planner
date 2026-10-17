import ShopList from "@/components/shop/ShopList"
import { groceryItemInclude, toGroceryItemDTO } from "@/lib/dto"
import { prisma } from "@/lib/prisma"
import { requireActivePlan } from "@/lib/session"
import { tagsOfPlan } from "@/lib/tags/queries"
import { listsOfPlan } from "@/lib/grocery/queries"

export default async function ShopPage({ searchParams }: PageProps<"/shop">) {
	const { planId } = await requireActivePlan()
	const { list } = await searchParams

	const lists = await listsOfPlan(planId)
	// alle Items des Plans laden – Wechsel und Verschieben zwischen Listen funktionieren dann ohne Refetch
	const items = await prisma.groceryItem.findMany({
		where: { list: { planId } },
		include: groceryItemInclude,
		orderBy: { createdAt: "asc" },
	})
	const tags = await tagsOfPlan(planId)
	const selectedListId = lists.find((candidate) => candidate.id === list)?.id ?? lists[0]?.id

	return (
		<ShopList
			key={lists.map((candidate) => candidate.id + candidate.name).join()}
			planId={planId}
			lists={lists}
			tags={tags}
			initialListId={selectedListId}
			initialItems={items.map(toGroceryItemDTO)}
		/>
	)
}
