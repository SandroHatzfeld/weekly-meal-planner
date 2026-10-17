"use client"

import { createDish } from "@/lib/dishes/actions"
import type { DishDTO } from "@/lib/dto"
import IngredientPicker from "@/components/recipes/IngredientPicker"
import { planRecipe, searchRecipes, type RecipeSuggestion } from "@/lib/recipes/actions"
import { initialEntries, toPlannedItems, type IngredientEntry } from "@/lib/recipes/planning"
import type { TagDTO } from "@/lib/tags/icons"
import { useEffect, useId, useState } from "react"

type AddDishProps = {
	planId: string
	day: string
	lists: { id: string; name: string }[]
	defaultListId: string // aus den Plan-Einstellungen
	tags: TagDTO[]
	divider?: boolean // Linie nach unten, wenn darunter weitere Gerichte folgen
	onCreated: (dish: DishDTO) => void
}

// Direkte Eingabe eines Gerichts. Passt der Name zu gespeicherten Rezepten, werden sie vorgeschlagen;
// ein gewähltes Rezept wird per Copy-on-Plan inkl. Zutatenauswahl geplant.
export default function AddDish({ planId, day, lists, defaultListId, tags, divider = false, onCreated }: AddDishProps) {
	const listboxId = useId()
	const [open, setOpen] = useState(false)
	const [name, setName] = useState("")
	const [suggestions, setSuggestions] = useState<{ query: string; recipes: RecipeSuggestion[] }>({ query: "", recipes: [] })
	const [activeIndex, setActiveIndex] = useState(-1)
	const [dismissed, setDismissed] = useState(false)
	const [recipe, setRecipe] = useState<RecipeSuggestion | null>(null)
	const [entries, setEntries] = useState<IngredientEntry[]>([])
	const [saving, setSaving] = useState(false)

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

	const reset = () => {
		setOpen(false)
		setName("")
		setRecipe(null)
		setActiveIndex(-1)
		setDismissed(false)
	}

	const pickRecipe = (suggestion: RecipeSuggestion) => {
		setRecipe(suggestion)
		setName(suggestion.name)
		setEntries(initialEntries(suggestion.ingredients))
	}

	const submit = async () => {
		setSaving(true)
		if (recipe) {
			const result = await planRecipe(recipe.id, { planId, date: day, items: toPlannedItems(entries, defaultListId) })
			if ("dish" in result && result.dish) onCreated(result.dish)
		} else {
			const dish = await createDish(planId, name, day)
			if (dish) onCreated(dish)
		}
		setSaving(false)
		reset()
	}

	if (!open) {
		return (
			<button type="button" className="btn-link text-sm" onClick={() => setOpen(true)}>
				+ Gericht
			</button>
		)
	}

	return (
		<form
			className={`flex w-full flex-col gap-3 ${divider ? "border-b border-(--border) pb-4" : ""} ${recipe ? "" : "sm:w-auto"}`}
			onSubmit={(event) => {
				event.preventDefault()
				submit()
			}}
		>
			<div className="flex flex-wrap items-center gap-x-3 gap-y-3">
				<div className="w-full sm:relative sm:w-auto">
					<input
						autoFocus
						className="input sm:w-56"
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
							} else if (event.key === "Escape") {
								if (visible.length) setDismissed(true)
								else reset()
							}
						}}
					/>
					{visible.length > 0 && (
						<ul id={listboxId} role="listbox" className="suggestions">
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
				<div className="flex items-center gap-3">
					<button type="submit" className="btn px-5 py-2" disabled={saving || (!!recipe && !defaultListId)}>
						{recipe ? "Planen" : "Hinzufügen"}
					</button>
					<button type="button" className="btn-secondary py-2" onClick={reset}>
						Abbrechen
					</button>
				</div>
			</div>

			{recipe && (
				<div className="space-y-1 text-sm">
					<IngredientPicker
						entries={entries}
						onChange={setEntries}
						lists={lists}
						tags={tags}
						defaultListId={defaultListId}
						className="sm:grid-cols-4 md:grid-cols-5"
					/>
				</div>
			)}
		</form>
	)
}
