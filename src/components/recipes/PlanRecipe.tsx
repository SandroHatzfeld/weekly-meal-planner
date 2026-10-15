"use client"

import { planRecipe } from "@/lib/recipes/actions"
import Link from "next/link"
import { useState } from "react"

type PlanRecipeProps = {
	recipeId: string
	ingredients: { id: string; label: string }[]
	plans: { id: string; name: string; lists: { id: string; name: string }[] }[]
	defaultPlanId: string
	defaultDate: string
}

export default function PlanRecipe({ recipeId, ingredients, plans, defaultPlanId, defaultDate }: PlanRecipeProps) {
	const [planId, setPlanId] = useState(defaultPlanId)
	const plan = plans.find((candidate) => candidate.id === planId) ?? plans[0]
	const [listId, setListId] = useState(plan.lists[0]?.id ?? "")
	const [date, setDate] = useState(defaultDate)
	// Opt-out: alle Zutaten vorausgewählt
	const [selected, setSelected] = useState(() => new Set(ingredients.map((ingredient) => ingredient.id)))
	const [result, setResult] = useState<{ error?: string; dishId?: string } | null>(null)
	const [saving, setSaving] = useState(false)

	return (
		<form
			className="card space-y-3"
			onSubmit={async (event) => {
				event.preventDefault()
				setSaving(true)
				setResult(await planRecipe(recipeId, { planId, listId, date, ingredientIds: [...selected] }))
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
					Einkaufsliste
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

			{ingredients.length > 0 && (
				<fieldset className="text-sm">
					<legend className="mb-1">Auf die Einkaufsliste:</legend>
					{ingredients.map((ingredient) => (
						<label key={ingredient.id} className="flex items-center gap-2">
							<input
								type="checkbox"
								checked={selected.has(ingredient.id)}
								onChange={(event) => {
									const next = new Set(selected)
									if (event.target.checked) next.add(ingredient.id)
									else next.delete(ingredient.id)
									setSelected(next)
								}}
							/>
							{ingredient.label}
						</label>
					))}
				</fieldset>
			)}

			<button type="submit" className="btn w-full" disabled={saving || !listId}>
				Speichern
			</button>
			{result?.error && <p className="error">{result.error}</p>}
			{result?.dishId && (
				<p className="text-sm">
					Geplant! {planId === defaultPlanId && <Link href={`/dishes/${result.dishId}`}>Gericht ansehen</Link>}
				</p>
			)}
		</form>
	)
}
