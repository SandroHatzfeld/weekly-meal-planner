import ShopList from "@/components/shop/ShopList"
import { toGroceryItemDTO } from "@/lib/dto"
import { prisma } from "@/lib/prisma"
import { requireActivePlan } from "@/lib/session"

export default async function ShopPage({ searchParams }: PageProps<"/shop">) {
	const { planId } = await requireActivePlan()
	const { list } = await searchParams

	const lists = await prisma.groceryList.findMany({
		where: { planId },
		select: { id: true, name: true },
		orderBy: { createdAt: "asc" },
	})
	// alle Items des Plans laden – Wechsel und Verschieben zwischen Listen funktionieren dann ohne Refetch
	const items = await prisma.groceryItem.findMany({
		where: { list: { planId } },
		include: { dish: { select: { name: true } } },
		orderBy: { createdAt: "asc" },
	})
	const selectedListId = lists.find((candidate) => candidate.id === list)?.id ?? lists[0]?.id

	return (
		<ShopList
			key={lists.map((candidate) => candidate.id + candidate.name).join()}
			planId={planId}
			lists={lists}
			initialListId={selectedListId}
			initialItems={items.map(toGroceryItemDTO)}
		/>
	)
}
