"use client"

import { planRecipe } from "@/lib/recipes/actions"
import { initialEntries, toPlannedItems, type PlanIngredient } from "@/lib/recipes/planning"
import type { TagDTO } from "@/lib/tags/icons"
import { useRouter } from "next/navigation"
import IngredientPicker from "./IngredientPicker"
import { useState } from "react"

type PlanRecipeProps = {
	recipeId: string
	ingredients: PlanIngredient[]
	plans: { id: string; name: string; lists: { id: string; name: string }[]; defaultListId: string; tags: TagDTO[] }[]
	defaultPlanId: string
	defaultDate: string
}

export default function PlanRecipe({ recipeId, ingredients, plans, defaultPlanId, defaultDate }: PlanRecipeProps) {
	const [planId, setPlanId] = useState(defaultPlanId)
	const plan = plans.find((candidate) => candidate.id === planId) ?? plans[0]
	const [date, setDate] = useState(defaultDate)
	const [entries, setEntries] = useState(() => initialEntries(ingredients))
	const router = useRouter()
	const [error, setError] = useState<string | null>(null)
	const [saving, setSaving] = useState(false)

	return (
		<form
			className="card space-y-3"
			onSubmit={async (event) => {
				event.preventDefault()
				setSaving(true)
				setError(null)
				const result = await planRecipe(recipeId, { planId, date, items: toPlannedItems(entries, plan.defaultListId) })
				// geplant -> Rezept schließen, zurück zur Übersicht
				if (result.dishId) return router.push("/recipes")
				setError(result.error ?? "Planen fehlgeschlagen")
				setSaving(false)
			}}
		>
			<h3 className="font-semibold">Planen</h3>

			{/* Plan-Auswahl entfällt, wenn es nur einen Plan gibt */}
			{plans.length > 1 && (
				<label className="block text-sm">
					Plan
					<select
						className="input"
						value={planId}
						onChange={(event) => {
							setPlanId(event.target.value)
							// Listen und Tags gehören zum Plan -> Anpassungen zurücksetzen
							setEntries(initialEntries(ingredients))
						}}
					>
						{plans.map((candidate) => (
							<option key={candidate.id} value={candidate.id}>
								{candidate.name}
							</option>
						))}
					</select>
				</label>
			)}
			{/* Listen-Auswahl entfällt, wenn der Plan nur eine Liste hat */}
			<label className="block text-sm">
				Tag
				<input type="date" className="input" value={date} onChange={(event) => setDate(event.target.value)} required />
			</label>

			<IngredientPicker entries={entries} onChange={setEntries} lists={plan.lists} tags={plan.tags} defaultListId={plan.defaultListId} />

			<button type="submit" className="btn w-full" disabled={saving || !plan.defaultListId}>
				Speichern
			</button>
			{error && <p className="error">{error}</p>}
		</form>
	)
}
