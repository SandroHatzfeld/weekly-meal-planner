"use client"

import IngredientPicker from "@/components/recipes/IngredientPicker"
import Modal from "@/components/ui/Modal"
import { useCombobox } from "@/components/ui/useCombobox"
import { formatMinutes } from "@/lib/recipes/format"
import ManualItemRow, { isManualEntry } from "@/components/dishes/ManualItemRow"
import { PAST_DAY_MESSAGE } from "@/lib/dates"
import { createDish } from "@/lib/dishes/actions"
import type { DishDTO } from "@/lib/dto"
import { planDish, planRecipe, searchRecipes, type RecipeSuggestion } from "@/lib/recipes/actions"
import { initialEntries, toPlannedItems, type IngredientEntry } from "@/lib/recipes/planning"
import type { CategoryDTO, ProductMemoryDTO } from "@/lib/grocery/categories"
import type { TagDTO } from "@/lib/tags/icons"
import { useEffect, useState } from "react"

export type PlanOption = {
	id: string
	name: string
	lists: { id: string; name: string }[]
	defaultListId: string
	tags: TagDTO[]
	categories: CategoryDTO[]
	// bekannte Produkte für die Vorschläge beim manuellen Hinzufügen
	memory: ProductMemoryDTO[]
}

type PlanDishDialogProps = {
	open: boolean
	onClose: () => void
	plans: PlanOption[]
	initialPlanId: string
	initialDate: string
	// heute: frühestes wählbares Datum, vergangene Tage lassen sich nicht planen
	today: string
	initialRecipe?: RecipeSuggestion // Rezeptseite: Rezept ist schon gewählt
	onPlanned: (dish: DishDTO) => void
}

// Ein Popup für alles Planen: freier Name oder Rezept aus den Vorschlägen, Datum, Zutatenauswahl.
// Genutzt in Woche, Monat und auf der Rezeptseite.
export default function PlanDishDialog({ open, onClose, ...props }: PlanDishDialogProps) {
	return (
		<Modal open={open} onClose={onClose} labelledBy="plan-dish-title" widthClass="w-[min(36rem,calc(100%-2rem))]">
			{/* nur im geöffneten Zustand gerendert -> jedes Öffnen startet mit frischem Formular */}
			<PlanDishForm {...props} onClose={onClose} />
		</Modal>
	)
}

function PlanDishForm({ plans, initialPlanId, initialDate, today, initialRecipe, onPlanned, onClose }: Omit<PlanDishDialogProps, "open">) {
	const [planId, setPlanId] = useState(initialPlanId)
	const plan = plans.find((candidate) => candidate.id === planId) ?? plans[0]
	const [date, setDate] = useState(initialDate)
	const [name, setName] = useState(initialRecipe?.name ?? "")
	const [recipe, setRecipe] = useState<RecipeSuggestion | null>(initialRecipe ?? null)
	const [entries, setEntries] = useState<IngredientEntry[]>(() => (initialRecipe ? initialEntries(initialRecipe.ingredients) : []))
	const [suggestions, setSuggestions] = useState<{ query: string; recipes: RecipeSuggestion[] }>({ query: "", recipes: [] })
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState<string | null>(null)

	// Suche mit kurzer Verzögerung, nicht bei jedem Tastendruck
	useEffect(() => {
		const query = name.trim()
		if (recipe || query.length < 2) return
		let cancelled = false
		const timer = setTimeout(async () => {
			const recipes = await searchRecipes(planId, query)
			if (!cancelled) setSuggestions({ query, recipes })
		}, 200)
		return () => {
			cancelled = true
			clearTimeout(timer)
		}
	}, [name, planId, recipe])

	// von Hand hinzugefügte Produkte bleiben, wenn Rezept oder Plan wechseln
	const withManual = (recipeEntries: IngredientEntry[]) => (current: IngredientEntry[]) => [...recipeEntries, ...current.filter(isManualEntry)]

	const pickRecipe = (suggestion: RecipeSuggestion) => {
		setRecipe(suggestion)
		setName(suggestion.name)
		setEntries(withManual(initialEntries(suggestion.ingredients)))
	}
	// nur Ergebnisse zur aktuellen Eingabe anzeigen
	const combobox = useCombobox(!recipe && suggestions.query === name.trim() ? suggestions.recipes : [], pickRecipe)
	const visible = combobox.visible

	const submit = async () => {
		if (date < today) return setError(PAST_DAY_MESSAGE)
		setSaving(true)
		setError(null)
		const items = toPlannedItems(entries, plan.defaultListId)
		const dish = recipe
			? ((await planRecipe(recipe.id, { planId, date, items })) as { dish?: DishDTO; error?: string })
			: items.length > 0
				? ((await planDish({ planId, date, name, items })) as { dish?: DishDTO; error?: string })
				: { dish: (await createDish(planId, name, date)) ?? undefined, error: "Bitte Name und Datum angeben" }
		setSaving(false)
		if (!dish.dish) return setError(dish.error ?? "Planen fehlgeschlagen")
		onPlanned(dish.dish)
		onClose()
	}

	return (
		<form
			className="form max-w-none gap-3 p-4"
			onSubmit={(event) => {
				event.preventDefault()
				submit()
			}}
		>
			<h2 id="plan-dish-title" className="text-lg font-semibold">
				Gericht planen
			</h2>

			{/* Plan-Auswahl nur, wenn es mehrere Pläne gibt (Rezeptseite) */}
			{plans.length > 1 && (
				<>
					<label htmlFor="plan-dish-plan">Plan</label>
					<select
						id="plan-dish-plan"
						className="input"
						value={planId}
						onChange={(event) => {
							setPlanId(event.target.value)
							// Listen und Tags gehören zum Plan -> Anpassungen zurücksetzen
							setEntries(withManual(recipe ? initialEntries(recipe.ingredients) : []))
						}}
					>
						{plans.map((candidate) => (
							<option key={candidate.id} value={candidate.id}>
								{candidate.name}
							</option>
						))}
					</select>
				</>
			)}

			<label htmlFor="plan-dish-name">Gericht</label>
			<div>
				<input
					id="plan-dish-name"
					autoFocus={!initialRecipe}
					value={name}
					placeholder="Name oder Rezept suchen"
					{...combobox.inputProps}
					required
					onChange={(event) => {
						// weitertippen hebt eine gewählte Rezept-Vorlage auf (ihre Zutaten gehen mit, eigene Produkte bleiben)
						if (recipe) {
							setRecipe(null)
							setEntries(withManual([]))
						}
						setName(event.target.value)
						combobox.reset()
					}}
				/>
				{visible.length > 0 && (
					// im Popup im Fluss statt schwebend, damit nichts am Rand abgeschnitten wird
					<ul {...combobox.listboxProps} className="suggestions static! sm:w-full">
						{visible.map((suggestion, index) => (
							<li key={suggestion.id} {...combobox.optionProps(index)}>
								<span>{suggestion.name}</span>
								<span className="text-xs opacity-60">
									{[suggestion.minutes ? formatMinutes(suggestion.minutes) : null, suggestion.rating ? `${suggestion.rating}★` : null, suggestion.ownerName ? `von ${suggestion.ownerName}` : "Mein Rezept"].filter(Boolean).join(" · ")}
								</span>
							</li>
						))}
					</ul>
				)}
			</div>

			<label htmlFor="plan-dish-date">Datum</label>
			<input id="plan-dish-date" type="date" value={date} min={today} onChange={(event) => setDate(event.target.value)} required />

			{(recipe || entries.length > 0) && (
				<IngredientPicker
					entries={entries}
					onChange={setEntries}
					lists={plan.lists}
					tags={plan.tags}
					categories={plan.categories}
					defaultListId={plan.defaultListId}
					className="sm:grid-cols-3"
				/>
			)}

			{/* Produkte von Hand auf die Einkaufsliste setzen, mit oder ohne Rezept */}
			<ManualItemRow
				memory={plan.memory}
				categories={plan.categories}
				tags={plan.tags}
				onAdd={(entry) => setEntries((current) => [...current, entry])}
			/>

			{error && <p className="error">{error}</p>}
			<div className="mt-1 flex items-center gap-3">
				<button type="submit" className="px-5 py-2" disabled={saving || ((!!recipe || entries.length > 0) && !plan.defaultListId)}>
					Planen
				</button>
				<button type="button" className="btn-secondary py-2" onClick={onClose}>
					Abbrechen
				</button>
			</div>
		</form>
	)
}
