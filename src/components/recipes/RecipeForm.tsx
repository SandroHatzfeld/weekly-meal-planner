"use client"

import { createRecipe, deleteRecipe, updateRecipe, type RecipeInput } from "@/lib/recipes/actions"
import ImageField from "@/components/forms/ImageField"
import StepsField from "@/components/forms/StepsField"
import Icon, { handleButtonClass, iconButtonClass } from "@/components/ui/Icon"
import { useSortable } from "@/components/ui/useSortable"
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
}

export default function RecipeForm({ recipeId, initial = emptyRecipe }: { recipeId?: string; initial?: RecipeInput }) {
	const [recipe, setRecipe] = useState<RecipeInput>({
		...initial,
		ingredients: initial.ingredients.length ? initial.ingredients : [{ name: "", amount: "", unit: "" }],
	})
	const [keys, setKeys] = useState(() => recipe.ingredients.map(ingredientKey))
	const sortable = useSortable(keys, (ids) => {
		setRecipe((current) => ({
			...current,
			ingredients: ids.map((id) => current.ingredients[keys.indexOf(id)]),
		}))
		setKeys(ids)
	})
	const addIngredient = () => {
		setRecipe((current) => ({
			...current,
			ingredients: [...current.ingredients, { name: "", amount: "", unit: "" }],
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
								className="input w-16 min-w-0 sm:w-20"
								placeholder="Menge"
								value={ingredient.amount}
								onChange={(event) => setIngredient(index, { amount: event.target.value })}
							/>
							<input
								className="input w-16 min-w-0 sm:w-24"
								placeholder="Einheit"
								value={ingredient.unit}
								onChange={(event) => setIngredient(index, { unit: event.target.value })}
							/>
							<input
								className="input min-w-0 flex-1"
								placeholder="Zutat"
								value={ingredient.name}
								onChange={(event) => setIngredient(index, { name: event.target.value })}
							/>
							<button type="button" className="btn-link" aria-label="Zutat entfernen" onClick={() => removeIngredient(index)}>
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
	return (
		<button
			type="button"
			className={`${iconButtonClass} text-red-600`}
			aria-label="Rezept löschen"
			title="Löschen"
			onClick={async () => {
				// bereits geplante Dishes bleiben erhalten (Snapshot), nur sourceRecipeId wird NULL
				if (confirm("Rezept löschen? Bereits geplante Gerichte bleiben erhalten.")) await deleteRecipe(recipeId)
			}}
		>
			<Icon name="trash" />
		</button>
	)
}
