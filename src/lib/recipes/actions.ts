"use server"

import { redirect } from "next/navigation"
import { auth } from "../auth/auth"
import { parseDateKey } from "../dates"
import { toDishDTO } from "../dto"
import { prisma } from "../prisma"
import { emitToPlan } from "../realtime"
import { requireMember } from "../session"
import { groceryItemInclude, toGroceryItemDTO } from "../dto"
import { deleteImageIfUnused, resolveImage } from "../images"
import { recallCategory, rememberProduct } from "../grocery/categories"
import { canViewRecipe, coMemberIds } from "./access"
import { ImportError, importRecipe } from "./import/service"
import { llmConfig } from "./import/llm"
import type { PlanIngredient, PlannedItem } from "./planning"

export type IngredientInput = { name: string; details: string }
export type RecipeInput = {
	name: string
	description: string
	imageUrl: string
	steps: string[]
	ingredients: IngredientInput[]
	sourceUrl?: string
}

const requireSessionUser = async () => {
	const session = await auth()
	if (!session?.user?.id) redirect("/login")
	return session.user
}

const normalize = (input: RecipeInput) => ({
	name: input.name.trim(),
	description: input.description.trim() || null,
	steps: input.steps.map((step) => step.trim()).filter(Boolean),
	sourceUrl: /^https?:\/\//i.test(input.sourceUrl ?? "") ? input.sourceUrl!.slice(0, 2000) : null,
	ingredients: input.ingredients
		.filter((ingredient) => ingredient.name.trim())
		.map((ingredient) => ({ name: ingredient.name.trim(), details: ingredient.details.trim() || null })),
})

// Rezept von einem Link laden und aufbereiten; liefert nur die Vorbelegung für das Formular, gespeichert wird erst dort
export const importRecipeFromUrl = async (url: string, refresh = false): Promise<{ recipe: RecipeInput; cached: boolean } | { error: string }> => {
	const user = await requireSessionUser()
	if (!llmConfig()) return { error: "Der Import ist nicht eingerichtet (LLM_BASE_URL und LLM_MODEL in der .env)" }
	try {
		const { recipe, sourceUrl, cached } = await importRecipe(user.id, url, refresh)
		return { recipe: { ...recipe, sourceUrl }, cached }
	} catch (error) {
		if (error instanceof ImportError) return { error: error.message }
		throw error
	}
}

export const createRecipe = async (input: RecipeInput) => {
	const user = await requireSessionUser()
	const data = normalize(input)
	if (!data.name) return { error: "Bitte gib einen Namen an" }
	const image = await resolveImage(input.imageUrl)
	if ("error" in image) return image
	const recipe = await prisma.recipe.create({
		data: { ...data, imageUrl: image.imageUrl, userId: user.id, ingredients: { create: data.ingredients } },
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
	const image = await resolveImage(input.imageUrl)
	if ("error" in image) return image

	await prisma.$transaction([
		prisma.recipeIngredient.deleteMany({ where: { recipeId } }),
		prisma.recipe.update({
			where: { id: recipeId },
			data: { ...data, imageUrl: image.imageUrl, ingredients: { create: data.ingredients } },
		}),
	])
	if (recipe.imageUrl !== image.imageUrl) await deleteImageIfUnused(recipe.imageUrl)
	redirect(`/recipes/${recipeId}`)
}

export const deleteRecipe = async (recipeId: string) => {
	const user = await requireSessionUser()
	const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } })
	if (!recipe || recipe.userId !== user.id) return
	await prisma.recipe.delete({ where: { id: recipeId } })
	// geplante Gerichte können das Bild als Snapshot weiter nutzen -> wird dann behalten
	await deleteImageIfUnused(recipe.imageUrl)
	redirect("/recipes")
}

// Copy-on-Plan: Snapshot des Rezepts als neuer Dish + die ausgewählten (ggf. angepassten) Zutaten als GroceryItems
export const planRecipe = async (recipeId: string, target: { planId: string; date: string; items: PlannedItem[] }) => {
	const { user } = await requireMember(target.planId)
	const date = parseDateKey(target.date)
	if (!date) return { error: "Bitte wähle einen Tag" }

	const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } })
	if (!recipe || !(await canViewRecipe(user.id, recipe.userId))) return { error: "Rezept nicht gefunden" }

	// Listen und Tags müssen zum Ziel-Plan gehören
	const [lists, tags] = await Promise.all([
		prisma.groceryList.findMany({ where: { planId: target.planId }, select: { id: true } }),
		prisma.planTag.findMany({ where: { planId: target.planId }, select: { id: true } }),
	])
	const listIds = new Set(lists.map((list) => list.id))
	const tagIds = new Set(tags.map((tag) => tag.id))
	const items = target.items.filter((item) => item.name.trim())
	if (items.some((item) => !listIds.has(item.listId))) return { error: "Liste gehört nicht zum Plan" }

	// Kategorie je Zutat: im Popup gewählt (muss zum Ziel-Plan gehören) oder zuletzt gemerkte
	const categories = await prisma.groceryCategory.findMany({ where: { planId: target.planId }, select: { id: true } })
	const categoryIds = await Promise.all(
		items.map(async (item) =>
			item.categoryId && categories.some((category) => category.id === item.categoryId)
				? item.categoryId
				: recallCategory(target.planId, item.name),
		),
	)

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
				create: items.map((item, index) => ({
					listId: item.listId,
					name: item.name.trim(),
					details: item.details?.trim() || null,
					categoryId: categoryIds[index],
					tags: { connect: item.tagIds.filter((id) => tagIds.has(id)).map((id) => ({ id })) },
				})),
			},
		},
		include: { groceryItems: { include: groceryItemInclude } },
	})

	await Promise.all(
		items.map((item, index) => rememberProduct(target.planId, item.name, categoryIds[index], item.categoryId === categoryIds[index] && !!item.categoryId)),
	)
	emitToPlan(target.planId, "dish-created", toDishDTO(dish))
	for (const item of dish.groceryItems) emitToPlan(target.planId, "grocery-item-created", toGroceryItemDTO(item))

	return { dishId: dish.id, dish: toDishDTO(dish) }
}

export type RecipeSuggestion = {
	id: string
	name: string
	ownerName: string | null // null = eigenes Rezept
	ingredients: PlanIngredient[]
}

// Vorschläge beim direkten Anlegen in der Wochenansicht: Rezeptbücher aller Plan-Mitglieder
export const searchRecipes = async (planId: string, query: string): Promise<RecipeSuggestion[]> => {
	const { user } = await requireMember(planId)
	const term = query.trim()
	if (term.length < 2) return []

	const recipes = await prisma.recipe.findMany({
		where: { userId: { in: await coMemberIds(user.id, planId) }, name: { contains: term, mode: "insensitive" } },
		include: { ingredients: true, user: { select: { name: true } } },
		orderBy: { name: "asc" },
		take: 8,
	})
	return recipes.map((recipe) => ({
		id: recipe.id,
		name: recipe.name,
		ownerName: recipe.userId === user.id ? null : recipe.user.name,
		ingredients: recipe.ingredients.map((ingredient) => ({ id: ingredient.id, name: ingredient.name, details: ingredient.details })),
	}))
}
