"use client"

import { useCombobox } from "@/components/ui/useCombobox"
import type { CategoryDTO, ProductMemoryDTO } from "@/lib/grocery/categories"
import { suggestProducts, type ProductSuggestion } from "@/lib/grocery/suggest"

type ProductInputProps = {
	value: string
	onChange: (value: string) => void
	// Vorschlag gewählt: Schreibweise + Kategorie übernehmen
	onPick: (suggestion: ProductSuggestion) => void
	memory: ProductMemoryDTO[]
	// leer: Vorschläge ohne Kategorie anzeigen (z.B. Zutaten im Rezept)
	categories: CategoryDTO[]
	placeholder: string
	ariaLabel?: string
	className?: string
	inputClassName?: string
	// false: Feld darf leer bleiben (z.B. innerhalb eines anderen Formulars)
	required?: boolean
}

// Eingabe für Produkte mit Vorschlägen aus bekannten Produkten des Plans (auch bei Vertippern)
export default function ProductInput({ value, onChange, onPick, memory, categories, placeholder, ariaLabel, className = "", inputClassName = "", required = true }: ProductInputProps) {
	const suggestions = suggestProducts(value, memory)
		// exakt das Getippte vorzuschlagen bringt nichts (außer es bringt eine Kategorie mit)
		.filter((suggestion) => suggestion.displayName !== value.trim() || (categories.length > 0 && suggestion.categoryId !== null))
	const combobox = useCombobox(suggestions, onPick)
	const categoryName = (id: string | null) => categories.find((category) => category.id === id)?.name
	const open = combobox.visible.length > 0

	return (
		<div className={`relative ${className}`}>
			<input
				className={`input w-full ${inputClassName}`}
				placeholder={placeholder}
				aria-label={ariaLabel}
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
					{...combobox.listboxProps}
					className="suggestions sm:w-full"
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
