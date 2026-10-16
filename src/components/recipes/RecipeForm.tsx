"use client"

import { createRecipe, deleteRecipe, updateRecipe, type RecipeInput } from "@/lib/recipes/actions"
import ImageField from "@/components/forms/ImageField"
import StepsField from "@/components/forms/StepsField"
import { useState } from "react"

const emptyRecipe: RecipeInput = { name: "", description: "", imageUrl: "", steps: [], ingredients: [] }

export default function RecipeForm({ recipeId, initial = emptyRecipe }: { recipeId?: string; initial?: RecipeInput }) {
	const [recipe, setRecipe] = useState<RecipeInput>({
		...initial,
		ingredients: initial.ingredients.length ? initial.ingredients : [{ name: "", amount: "", unit: "" }],
	})
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
				{recipe.ingredients.map((ingredient, index) => (
					<div key={index} className="flex gap-2">
						<input className="input w-20" placeholder="Menge" value={ingredient.amount} onChange={(event) => setIngredient(index, { amount: event.target.value })} />
						<input className="input w-24" placeholder="Einheit" value={ingredient.unit} onChange={(event) => setIngredient(index, { unit: event.target.value })} />
						<input className="input flex-1" placeholder="Zutat" value={ingredient.name} onChange={(event) => setIngredient(index, { name: event.target.value })} />
						<button
							type="button"
							className="btn-link"
							aria-label="Zutat entfernen"
							onClick={() => setRecipe({ ...recipe, ingredients: recipe.ingredients.filter((_, i) => i !== index) })}
						>
							✕
						</button>
					</div>
				))}
				<button
					type="button"
					className="btn-link"
					onClick={() => setRecipe({ ...recipe, ingredients: [...recipe.ingredients, { name: "", amount: "", unit: "" }] })}
				>
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
			className="btn-danger"
			onClick={async () => {
				// bereits geplante Dishes bleiben erhalten (Snapshot), nur sourceRecipeId wird NULL
				if (confirm("Rezept löschen? Bereits geplante Gerichte bleiben erhalten.")) await deleteRecipe(recipeId)
			}}
		>
			Löschen
		</button>
	)
}
