"use client"

import { useCombobox } from "@/components/ui/useCombobox"
import type { CategoryDTO, ProductMemoryDTO } from "@/lib/grocery/categories"
import { suggestProducts, type ProductSuggestion } from "@/lib/grocery/suggest"
import { useLayoutEffect, useRef } from "react"

type ProductInputProps = {
	value: string
	onChange: (value: string) => void
	// Vorschlag gewählt: Schreibweise + Kategorie übernehmen
	onPick: (suggestion: ProductSuggestion) => void
	memory: ProductMemoryDTO[]
	categories: CategoryDTO[]
	placeholder: string
	className?: string
	inputClassName?: string
	// false: Feld darf leer bleiben (z.B. innerhalb eines anderen Formulars)
	required?: boolean
	// Vorschläge im Fluss statt schwebend (in Popups, damit nichts abgeschnitten wird)
	inlineSuggestions?: boolean
	// Vorschläge über dem Feld öffnen, damit die Zeile darunter (Details, Hinzufügen) frei bleibt
	dropUp?: boolean
}

// Eingabe für Produkte mit Vorschlägen aus bekannten Produkten des Plans (auch bei Vertippern)
export default function ProductInput({ value, onChange, onPick, memory, categories, placeholder, className = "", inputClassName = "", required = true, inlineSuggestions = false, dropUp = false }: ProductInputProps) {
	const suggestions = suggestProducts(value, memory)
		// exakt das Getippte vorzuschlagen bringt nichts
		.filter((suggestion) => suggestion.displayName !== value.trim() || suggestion.categoryId !== null)
	const combobox = useCombobox(suggestions, onPick)
	const categoryName = (id: string | null) => categories.find((category) => category.id === id)?.name
	const list = useRef<HTMLUListElement>(null)
	const open = combobox.visible.length > 0

	// nach oben nur so hoch wie Platz ist (bis zum Rand des scrollenden Bereichs), der Rest scrollt in der Liste
	useLayoutEffect(() => {
		const element = list.current
		if (!dropUp || !open || !element?.parentElement) return
		let top = 0
		for (let ancestor = element.parentElement.parentElement; ancestor; ancestor = ancestor.parentElement) {
			const overflowY = getComputedStyle(ancestor).overflowY
			if (overflowY === "auto" || overflowY === "scroll" || overflowY === "hidden") {
				top = ancestor.getBoundingClientRect().top
				break
			}
		}
		element.style.maxHeight = `${Math.max(96, element.parentElement.getBoundingClientRect().top - top - 8)}px`
	}, [dropUp, open, combobox.visible.length])

	return (
		<div className={`relative ${className}`}>
			<input
				className={`input w-full ${inputClassName}`}
				placeholder={placeholder}
				value={value}
				required={required}
				autoComplete="off"
				{...combobox.inputProps}
				onChange={(event) => {
					onChange(event.target.value)
					combobox.reset()
				}}
			/>
			{open && (
				<ul
					ref={list}
					{...combobox.listboxProps}
					className={`suggestions sm:w-full ${inlineSuggestions ? "static! sm:w-full" : ""} ${dropUp && !inlineSuggestions ? "top-auto bottom-full mt-0 mb-1 overflow-y-auto" : ""}`}
				>
					{combobox.visible.map((suggestion, index) => (
						<li key={suggestion.displayName} {...combobox.optionProps(index)}>
							<span>
								{suggestion.displayName}
								{suggestion.via && <span className="text-xs opacity-60"> · {suggestion.via}</span>}
							</span>
							{categoryName(suggestion.categoryId) && (
								<span className="text-xs opacity-60">
									{categoryName(suggestion.categoryId)}
									{suggestion.categoryIds.length > 1 && ` +${suggestion.categoryIds.length - 1}`}
								</span>
							)}
						</li>
					))}
				</ul>
			)}
		</div>
	)
}
