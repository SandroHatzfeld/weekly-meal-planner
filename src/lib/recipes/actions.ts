"use server"

import { redirect } from "next/navigation"
import { auth } from "../auth/auth"
import { parseDateKey } from "../dates"
import { toDishDTO } from "../dto"
import { prisma } from "../prisma"
import { emitToPlan } from "../realtime"
import { requireMember } from "../session"
import { toGroceryItemDTO } from "../dto"
import { canViewRecipe } from "./access"

export type IngredientInput = { name: string; amount: string; unit: string }
export type RecipeInput = {
	name: string
	description: string
	imageUrl: string
	steps: string[]
	ingredients: IngredientInput[]
}

const requireSessionUser = async () => {
	const session = await auth()
	if (!session?.user?.id) redirect("/login")
	return session.user
}

const normalize = (input: RecipeInput) => ({
	name: input.name.trim(),
	description: input.description.trim() || null,
	imageUrl: input.imageUrl.trim() || null,
	steps: input.steps.map((step) => step.trim()).filter(Boolean),
	ingredients: input.ingredients
		.filter((ingredient) => ingredient.name.trim())
		.map((ingredient) => {
			const amount = parseFloat(ingredient.amount.replace(",", "."))
			return {
				name: ingredient.name.trim(),
				amount: Number.isFinite(amount) ? amount : null,
				unit: ingredient.unit.trim() || null,
			}
		}),
})

export const createRecipe = async (input: RecipeInput) => {
	const user = await requireSessionUser()
	const data = normalize(input)
	if (!data.name) return { error: "Bitte gib einen Namen an" }
	const recipe = await prisma.recipe.create({
		data: { ...data, userId: user.id, ingredients: { create: data.ingredients } },
	})
	redirect(`/recipes/${recipe.id}`)
}

// Rezepte sind nutzergebunden: nur der Owner editiert -> kein Konfliktfall
export const updateRecipe = async (recipeId: string, input: RecipeInput) => {
	const user = await requireSessionUser()
	const data = normalize(input)
	if (!data.name) return { error: "Bitte gib einen Namen an" }
	const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } })
	if (!recipe || recipe.userId !== user.id) return { error: "Nur eigene Rezepte können bearbeitet werden" }

	await prisma.$transaction([
		prisma.recipeIngredient.deleteMany({ where: { recipeId } }),
		prisma.recipe.update({
			where: { id: recipeId },
			data: { ...data, ingredients: { create: data.ingredients } },
		}),
	])
	redirect(`/recipes/${recipeId}`)
}

export const deleteRecipe = async (recipeId: string) => {
	const user = await requireSessionUser()
	await prisma.recipe.deleteMany({ where: { id: recipeId, userId: user.id } })
	redirect("/recipes")
}

const formatAmount = (amount: number | null, unit: string | null) =>
	[amount !== null ? amount.toLocaleString("de-DE") : null, unit].filter(Boolean).join(" ") || null

// Copy-on-Plan: Snapshot des Rezepts als neuer Dish + ausgewählte Zutaten als GroceryItems
export const planRecipe = async (
	recipeId: string,
	target: { planId: string; listId: string; date: string; ingredientIds: string[] },
) => {
	const { user } = await requireMember(target.planId)
	const date = parseDateKey(target.date)
	if (!date) return { error: "Bitte wähle einen Tag" }

	const recipe = await prisma.recipe.findUnique({ where: { id: recipeId }, include: { ingredients: true } })
	if (!recipe || !(await canViewRecipe(user.id, recipe.userId))) return { error: "Rezept nicht gefunden" }

	const list = await prisma.groceryList.findUnique({ where: { id: target.listId } })
	if (!list || list.planId !== target.planId) return { error: "Liste gehört nicht zum Plan" }

	const selected = recipe.ingredients.filter((ingredient) => target.ingredientIds.includes(ingredient.id))

	const dish = await prisma.dish.create({
		data: {
			planId: target.planId,
			sourceRecipeId: recipe.id,
			name: recipe.name,
			description: recipe.description,
			imageUrl: recipe.imageUrl,
			steps: recipe.steps,
			date,
			groceryItems: {
				create: selected.map((ingredient) => ({
					listId: list.id,
					name: ingredient.name,
					details: formatAmount(ingredient.amount, ingredient.unit),
				})),
			},
		},
		include: { groceryItems: { include: { dish: { select: { name: true } } } } },
	})

	emitToPlan(target.planId, "dish-created", toDishDTO(dish))
	for (const item of dish.groceryItems) emitToPlan(target.planId, "grocery-item-created", toGroceryItemDTO(item))

	return { dishId: dish.id }
}
