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
	categories: CategoryDTO[]
	placeholder: string
	className?: string
}

// Eingabe für Produkte mit Vorschlägen aus bekannten Produkten des Plans (auch bei Vertippern)
export default function ProductInput({ value, onChange, onPick, memory, categories, placeholder, className = "" }: ProductInputProps) {
	const suggestions = suggestProducts(value, memory)
		// exakt das Getippte vorzuschlagen bringt nichts
		.filter((suggestion) => suggestion.displayName !== value.trim() || suggestion.categoryId !== null)
	const combobox = useCombobox(suggestions, onPick)
	const categoryName = (id: string | null) => categories.find((category) => category.id === id)?.name

	return (
		<div className={`relative ${className}`}>
			<input
				className="input w-full"
				placeholder={placeholder}
				value={value}
				required
				autoComplete="off"
				{...combobox.inputProps}
				onChange={(event) => {
					onChange(event.target.value)
					combobox.reset()
				}}
			/>
			{combobox.visible.length > 0 && (
				<ul {...combobox.listboxProps} className="suggestions sm:w-full">
					{combobox.visible.map((suggestion, index) => (
						<li key={suggestion.displayName} {...combobox.optionProps(index)}>
							<span>{suggestion.displayName}</span>
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
