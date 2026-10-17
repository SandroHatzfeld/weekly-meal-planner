import DishEditor from "@/components/dishes/DishEditor"
import { toDishDTO, groceryItemInclude, toGroceryItemDTO } from "@/lib/dto"
import { prisma } from "@/lib/prisma"
import { requireActivePlan } from "@/lib/session"
import { notFound } from "next/navigation"
import { listsWithDefault } from "@/lib/grocery/queries"
import { tagsOfPlan } from "@/lib/tags/queries"

export default async function DishPage({ params }: PageProps<"/dishes/[id]">) {
	const { id } = await params
	const { user, planId } = await requireActivePlan()

	const dish = await prisma.dish.findUnique({
		where: { id },
		include: {
			groceryItems: { include: groceryItemInclude, orderBy: { createdAt: "asc" } },
			sourceRecipe: { select: { id: true, name: true } },
		},
	})
	// nur Dishes des aktiven Plans
	if (!dish || dish.planId !== planId) notFound()

	const [{ lists, defaultListId }, tags] = await Promise.all([listsWithDefault(planId), tagsOfPlan(planId)])

	return (
		<DishEditor
			initialDish={toDishDTO(dish)}
			initialItems={dish.groceryItems.map(toGroceryItemDTO)}
			lists={lists}
			defaultListId={defaultListId}
			tags={tags}
			sourceRecipe={dish.sourceRecipe}
			currentUserId={user.id}
		/>
	)
}
