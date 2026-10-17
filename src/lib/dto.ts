import { toDateKey } from "./dates"
import type { Dish, GroceryItem } from "../generated/prisma/client"

// Serialisierbare Formen für Client-Komponenten und Socket.io-Payloads

export type DishDTO = {
	id: string
	planId: string
	sourceRecipeId: string | null
	name: string
	description: string | null
	imageUrl: string | null
	steps: string[]
	date: string // YYYY-MM-DD
	updatedAt: string // ISO, für Optimistic Locking
}

export type GroceryItemDTO = {
	id: string
	listId: string
	dishId: string | null
	dishName: string | null
	name: string
	details: string | null
	checked: boolean
	tagIds: string[]
	createdAt: string
}

export const toDishDTO = (dish: Dish): DishDTO => ({
	id: dish.id,
	planId: dish.planId,
	sourceRecipeId: dish.sourceRecipeId,
	name: dish.name,
	description: dish.description,
	imageUrl: dish.imageUrl,
	steps: dish.steps,
	date: toDateKey(dish.date),
	updatedAt: dish.updatedAt.toISOString(),
})

// mit diesem include laden, damit das DTO vollständig ist
export const groceryItemInclude = { dish: { select: { name: true } }, tags: { select: { id: true } } } as const

export const toGroceryItemDTO = (
	item: GroceryItem & { dish?: { name: string } | null; tags?: { id: string }[] },
): GroceryItemDTO => ({
	id: item.id,
	listId: item.listId,
	dishId: item.dishId,
	dishName: item.dish?.name ?? null,
	name: item.name,
	details: item.details,
	checked: item.checked,
	tagIds: item.tags?.map((tag) => tag.id) ?? [],
	createdAt: item.createdAt.toISOString(),
})
