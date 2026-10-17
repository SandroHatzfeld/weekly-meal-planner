"use client"

import IngredientPicker from "@/components/recipes/IngredientPicker"
import Modal from "@/components/ui/Modal"
import { createDish } from "@/lib/dishes/actions"
import type { DishDTO } from "@/lib/dto"
import { planRecipe, searchRecipes, type RecipeSuggestion } from "@/lib/recipes/actions"
import { initialEntries, toPlannedItems, type IngredientEntry } from "@/lib/recipes/planning"
import type { TagDTO } from "@/lib/tags/icons"
import { useEffect, useId, useState } from "react"

export type PlanOption = {
	id: string
	name: string
	lists: { id: string; name: string }[]
	defaultListId: string
	tags: TagDTO[]
}

type PlanDishDialogProps = {
	open: boolean
	onClose: () => void
	plans: PlanOption[]
	initialPlanId: string
	initialDate: string
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

function PlanDishForm({ plans, initialPlanId, initialDate, initialRecipe, onPlanned, onClose }: Omit<PlanDishDialogProps, "open">) {
	const listboxId = useId()
	const [planId, setPlanId] = useState(initialPlanId)
	const plan = plans.find((candidate) => candidate.id === planId) ?? plans[0]
	const [date, setDate] = useState(initialDate)
	const [name, setName] = useState(initialRecipe?.name ?? "")
	const [recipe, setRecipe] = useState<RecipeSuggestion | null>(initialRecipe ?? null)
	const [entries, setEntries] = useState<IngredientEntry[]>(() => (initialRecipe ? initialEntries(initialRecipe.ingredients) : []))
	const [suggestions, setSuggestions] = useState<{ query: string; recipes: RecipeSuggestion[] }>({ query: "", recipes: [] })
	const [activeIndex, setActiveIndex] = useState(-1)
	const [dismissed, setDismissed] = useState(false)
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

	// nur Ergebnisse zur aktuellen Eingabe anzeigen
	const visible = !dismissed && !recipe && suggestions.query === name.trim() ? suggestions.recipes : []

	const pickRecipe = (suggestion: RecipeSuggestion) => {
		setRecipe(suggestion)
		setName(suggestion.name)
		setEntries(initialEntries(suggestion.ingredients))
		setActiveIndex(-1)
	}

	const submit = async () => {
		setSaving(true)
		setError(null)
		const dish = recipe
			? ((await planRecipe(recipe.id, { planId, date, items: toPlannedItems(entries, plan.defaultListId) })) as { dish?: DishDTO; error?: string })
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
							if (recipe) setEntries(initialEntries(recipe.ingredients))
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
					role="combobox"
					aria-autocomplete="list"
					aria-expanded={visible.length > 0}
					aria-controls={listboxId}
					aria-activedescendant={activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
					required
					onChange={(event) => {
						// weitertippen hebt eine gewählte Rezept-Vorlage auf
						if (recipe) setRecipe(null)
						setName(event.target.value)
						setActiveIndex(-1)
						setDismissed(false)
					}}
					onKeyDown={(event) => {
						if (event.key === "ArrowDown" && visible.length) {
							event.preventDefault()
							setActiveIndex((index) => (index + 1) % visible.length)
						} else if (event.key === "ArrowUp" && visible.length) {
							event.preventDefault()
							setActiveIndex((index) => (index <= 0 ? visible.length - 1 : index - 1))
						} else if (event.key === "Enter" && activeIndex >= 0 && visible[activeIndex]) {
							event.preventDefault()
							pickRecipe(visible[activeIndex])
						} else if (event.key === "Escape" && visible.length) {
							// erst die Vorschläge schließen, nicht gleich das ganze Popup
							event.preventDefault()
							setDismissed(true)
						}
					}}
				/>
				{visible.length > 0 && (
					// im Popup im Fluss statt schwebend, damit nichts am Rand abgeschnitten wird
					<ul id={listboxId} role="listbox" className="suggestions sm:static sm:w-full">
						{visible.map((suggestion, index) => (
							<li
								key={suggestion.id}
								id={`${listboxId}-${index}`}
								role="option"
								aria-selected={index === activeIndex}
								className={index === activeIndex ? "active" : ""}
								// mousedown statt click, damit das Input den Fokus nicht vorher verliert
								onMouseDown={(event) => {
									event.preventDefault()
									pickRecipe(suggestion)
								}}
							>
								<span>{suggestion.name}</span>
								<span className="text-xs opacity-60">{suggestion.ownerName ? `von ${suggestion.ownerName}` : "Mein Rezept"}</span>
							</li>
						))}
					</ul>
				)}
			</div>

			<label htmlFor="plan-dish-date">Datum</label>
			<input id="plan-dish-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} required />

			{recipe && (
				<IngredientPicker
					entries={entries}
					onChange={setEntries}
					lists={plan.lists}
					tags={plan.tags}
					defaultListId={plan.defaultListId}
					className="sm:grid-cols-3"
				/>
			)}

			{error && <p className="error">{error}</p>}
			<div className="mt-1 flex items-center gap-3">
				<button type="submit" className="px-5 py-2" disabled={saving || (!!recipe && !plan.defaultListId)}>
					Planen
				</button>
				<button type="button" className="btn-secondary py-2" onClick={onClose}>
					Abbrechen
				</button>
			</div>
		</form>
	)
}
