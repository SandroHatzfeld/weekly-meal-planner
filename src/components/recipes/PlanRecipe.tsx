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
	plans: { id: string; name: string; lists: { id: string; name: string }[]; tags: TagDTO[] }[]
	defaultPlanId: string
	defaultDate: string
}

export default function PlanRecipe({ recipeId, ingredients, plans, defaultPlanId, defaultDate }: PlanRecipeProps) {
	const [planId, setPlanId] = useState(defaultPlanId)
	const plan = plans.find((candidate) => candidate.id === planId) ?? plans[0]
	const [listId, setListId] = useState(plan.lists[0]?.id ?? "")
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
				const result = await planRecipe(recipeId, { planId, date, items: toPlannedItems(entries, listId) })
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
							setListId(plans.find((candidate) => candidate.id === event.target.value)?.lists[0]?.id ?? "")
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
			{plan.lists.length > 1 && (
				<label className="block text-sm">
					Standard-Einkaufsliste
					<select className="input" value={listId} onChange={(event) => setListId(event.target.value)}>
						{plan.lists.map((list) => (
							<option key={list.id} value={list.id}>
								{list.name}
							</option>
						))}
					</select>
				</label>
			)}

			<label className="block text-sm">
				Tag
				<input type="date" className="input" value={date} onChange={(event) => setDate(event.target.value)} required />
			</label>

			<IngredientPicker entries={entries} onChange={setEntries} lists={plan.lists} tags={plan.tags} defaultListId={listId} />

			<button type="submit" className="btn w-full" disabled={saving || !listId}>
				Speichern
			</button>
			{error && <p className="error">{error}</p>}
		</form>
	)
}
