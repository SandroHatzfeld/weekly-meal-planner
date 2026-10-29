"use client"

import { useFeedback } from "@/components/ui/Feedback"
import { createRecipe, deleteRecipe, updateRecipe, type RecipeInput } from "@/lib/recipes/actions"
import ImageField from "@/components/forms/ImageField"
import StepsField from "@/components/forms/StepsField"
import Icon, { handleButtonClass, iconButtonClass } from "@/components/ui/Icon"
import StarRating from "@/components/recipes/StarRating"
import { useSortable } from "@/components/ui/useSortable"
import ProductInput from "@/components/shop/ProductInput"
import type { ProductMemoryDTO } from "@/lib/grocery/categories"
import { useState } from "react"

// stabile Keys für Zutaten-Zeilen (Sortieren per Griff, Fokus bleibt beim Verschieben erhalten)
let nextIngredientKey = 0
const ingredientKey = () => `i${nextIngredientKey++}`

const emptyRecipe: RecipeInput = {
	name: "",
	description: "",
	imageUrl: "",
	steps: [],
	ingredients: [],
	minutes: null,
	rating: null,
}

// memory: bekannte Produkte des aktiven Plans, als Vorschläge für die Zutaten (ohne Kategorien)
export default function RecipeForm({ recipeId, initial = emptyRecipe, memory = [] }: { recipeId?: string; initial?: RecipeInput; memory?: ProductMemoryDTO[] }) {
	const [recipe, setRecipe] = useState<RecipeInput>({
		...initial,
		ingredients: initial.ingredients.length ? initial.ingredients : [{ name: "", details: "" }],
	})
	const [keys, setKeys] = useState(() => recipe.ingredients.map(ingredientKey))
	const sortable = useSortable(keys, (ids) => {
		// nur bekannte Zeilen übernehmen: eine veraltete Reihenfolge darf keine leeren Einträge erzeugen
		const known = ids.filter((id) => keys.includes(id))
		setRecipe((current) => ({
			...current,
			ingredients: known.map((id) => current.ingredients[keys.indexOf(id)]).filter(Boolean),
		}))
		setKeys(known)
	})
	const addIngredient = () => {
		setRecipe((current) => ({
			...current,
			ingredients: [...current.ingredients, { name: "", details: "" }],
		}))
		setKeys((current) => [...current, ingredientKey()])
	}
	const removeIngredient = (index: number) => {
		setRecipe((current) => ({
			...current,
			ingredients: current.ingredients.filter((_, i) => i !== index),
		}))
		setKeys((current) => current.filter((_, i) => i !== index))
	}
	const [error, setError] = useState<string | null>(null)
	const [saving, setSaving] = useState(false)

	const setIngredient = (index: number, patch: Partial<RecipeInput["ingredients"][number]>) =>
		setRecipe((current) => ({
			...current,
			ingredients: current.ingredients.map((ingredient, i) => (i === index ? { ...ingredient, ...patch } : ingredient)),
		}))

	return (
		<form
			id="recipe-form"
			className="form max-w-none"
			onSubmit={async (event) => {
				event.preventDefault()
				setSaving(true)
				// bei Erfolg leiten die Actions per redirect weiter
				const result = recipeId ? await updateRecipe(recipeId, recipe) : await createRecipe(recipe)
				setSaving(false)
				if (result?.error) setError(result.error)
			}}
		>
			<label htmlFor="name">Name</label>
			<input id="name" value={recipe.name} onChange={(event) => setRecipe({ ...recipe, name: event.target.value })} required />
			<label htmlFor="description">Beschreibung</label>
			<textarea id="description" rows={3} value={recipe.description} onChange={(event) => setRecipe({ ...recipe, description: event.target.value })} />
			<label htmlFor="minutes">Dauer (Minuten)</label>
			<input
				id="minutes"
				type="number"
				inputMode="numeric"
				min={1}
				max={1440}
				placeholder="z.B. 30"
				value={recipe.minutes ?? ""}
				onChange={(event) => setRecipe({ ...recipe, minutes: event.target.value ? Number(event.target.value) : null })}
			/>
			<div>
				<span className="block text-sm font-medium">Bewertung</span>
				<StarRating value={recipe.rating} onChange={(rating) => setRecipe((current) => ({ ...current, rating }))} />
			</div>
			<ImageField value={recipe.imageUrl} onChange={(imageUrl) => setRecipe((current) => ({ ...current, imageUrl }))} />

			<fieldset className="space-y-2">
				<legend className="font-semibold">Zutaten</legend>
				{sortable.order.map((key) => {
					const index = keys.indexOf(key)
					const ingredient = recipe.ingredients[index]
					if (!ingredient) return null
					return (
						<div
							key={key}
							ref={sortable.rowRef(key)}
							className={`flex items-center gap-2 ${sortable.dragId === key ? "rounded shadow-lg ring-2 ring-emerald-600" : ""}`}
						>
							<button
								type="button"
								aria-label={`Zutat ${ingredient.name || index + 1} verschieben`}
								title="Ziehen oder Pfeiltasten zum Sortieren"
								className={`${iconButtonClass} ${handleButtonClass}`}
								{...sortable.handleProps(key)}
							>
								<Icon name="grip" />
							</button>
							<input
								className="input w-24 min-w-0 sm:w-32"
								placeholder="Details (z.B. 400 ml)"
								aria-label="Details"
								value={ingredient.details}
								onChange={(event) => setIngredient(index, { details: event.target.value })}
							/>
							<ProductInput
								className="min-w-0 flex-1"
								placeholder="Zutat"
								ariaLabel="Zutat"
								value={ingredient.name}
								onChange={(name) => setIngredient(index, { name })}
								onPick={(suggestion) => setIngredient(index, { name: suggestion.displayName })}
								memory={memory}
								categories={[]}
								required={false}
							/>
							<button type="button" className="btn-link size-11 shrink-0 justify-center" aria-label="Zutat entfernen" onClick={() => removeIngredient(index)}>
								✕
							</button>
						</div>
					)
				})}
				<button type="button" className="btn-link" onClick={addIngredient}>
					+ Zutat
				</button>
			</fieldset>

			<StepsField initial={initial.steps} onChange={(steps) => setRecipe((current) => ({ ...current, steps }))} />
			{error && <p className="error">{error}</p>}
			<button type="submit" disabled={saving}>
				Speichern
			</button>
		</form>
	)
}

export function DeleteRecipeButton({ recipeId }: { recipeId: string }) {
	const { confirm } = useFeedback()
	return (
		<button
			type="button"
			className={`${iconButtonClass} text-red-700 dark:text-red-400`}
			aria-label="Rezept löschen"
			title="Löschen"
			onClick={async () => {
				// bereits geplante Dishes bleiben erhalten (Snapshot), nur sourceRecipeId wird NULL
				if (await confirm({ title: "Rezept löschen?", message: "Bereits geplante Gerichte bleiben erhalten.", confirmLabel: "Löschen", danger: true }))
					await deleteRecipe(recipeId)
			}}
		>
			<Icon name="trash" />
		</button>
	)
}
