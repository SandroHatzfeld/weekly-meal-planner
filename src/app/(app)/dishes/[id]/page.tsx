import DishEditor from "@/components/dishes/DishEditor"
import { toDishDTO, toGroceryItemDTO } from "@/lib/dto"
import { prisma } from "@/lib/prisma"
import { requireActivePlan } from "@/lib/session"
import { notFound } from "next/navigation"
import { listsOfPlan } from "@/lib/grocery/queries"

export default async function DishPage({ params }: PageProps<"/dishes/[id]">) {
	const { id } = await params
	const { user, planId } = await requireActivePlan()

	const dish = await prisma.dish.findUnique({
		where: { id },
		include: {
			groceryItems: { include: { dish: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
			sourceRecipe: { select: { id: true, name: true } },
		},
	})
	// nur Dishes des aktiven Plans
	if (!dish || dish.planId !== planId) notFound()

	const lists = await listsOfPlan(planId)

	return (
		<DishEditor
			initialDish={toDishDTO(dish)}
			initialItems={dish.groceryItems.map(toGroceryItemDTO)}
			lists={lists}
			sourceRecipe={dish.sourceRecipe}
			currentUserId={user.id}
		/>
	)
}
