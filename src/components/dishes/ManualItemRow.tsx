"use client"

import ProductInput from "@/components/shop/ProductInput"
import TagPicker from "@/components/tags/TagPicker"
import Icon from "@/components/ui/Icon"
import type { CategoryDTO, ProductMemoryDTO } from "@/lib/grocery/categories"
import type { IngredientEntry } from "@/lib/recipes/planning"
import type { TagDTO } from "@/lib/tags/icons"
import { useState } from "react"

// Manuelle Einträge im Planen-Popup erkennt man an der ID
export const MANUAL_PREFIX = "manual-"
export const isManualEntry = (entry: IngredientEntry) => entry.id.startsWith(MANUAL_PREFIX)

let counter = 0

// Zeile zum Hinzufügen eines Produkts von Hand innerhalb des Planen-Popups, wie auf der Einkaufsliste:
// Produkt + „+“, darunter Details und Tags; Enter oder ein gewählter Vorschlag fügt direkt hinzu.
// Das Produkt landet als Kachel in der Auswahl und beim Planen auf der Einkaufsliste, verknüpft mit dem Gericht.
// Kein <form> (liegt selbst in einem Formular).
export default function ManualItemRow({
	memory,
	categories,
	tags,
	onAdd,
}: {
	memory: ProductMemoryDTO[]
	categories: CategoryDTO[]
	tags: TagDTO[]
	onAdd: (entry: IngredientEntry) => void
}) {
	const [name, setName] = useState("")
	const [details, setDetails] = useState("")
	const [tagIds, setTagIds] = useState<string[]>([])
	const [pickedCategory, setPickedCategory] = useState<string | null>(null)

	const add = (itemName = name, categoryId = pickedCategory) => {
		if (!itemName.trim()) return
		onAdd({
			id: `${MANUAL_PREFIX}${counter++}`,
			name: itemName.trim(),
			details: details.trim() || null,
			selected: true,
			listId: null,
			tagIds,
			categoryId,
		})
		setName("")
		setDetails("")
		setTagIds([])
		setPickedCategory(null)
	}
	const submitOnEnter = (event: React.KeyboardEvent) => {
		if (event.key === "Enter" && !event.defaultPrevented) {
			event.preventDefault() // nicht das Planen-Formular absenden
			add()
		}
	}

	return (
		<fieldset className="space-y-2">
			<legend className="mb-1 text-sm">Produkt hinzufügen</legend>
			<div className="flex items-start gap-2" onKeyDown={submitOnEnter}>
				<ProductInput
					className="min-w-0 flex-1"
					inputClassName="min-h-10"
					placeholder="Was wird gebraucht?"
					value={name}
					required={false}
					onChange={(value) => {
						setName(value)
						setPickedCategory(null)
					}}
					// Vorschlag gewählt: direkt hinzufügen (mit eventuell schon eingetragenen Details und Tags)
					onPick={(suggestion) => add(suggestion.displayName, suggestion.categoryId)}
					memory={memory}
					categories={categories}
				/>
				<button
					type="button"
					className="btn flex size-10 shrink-0 items-center justify-center px-0"
					aria-label="Produkt hinzufügen"
					title="Produkt hinzufügen"
					disabled={!name.trim()}
					onClick={() => add()}
				>
					<Icon name="plus" />
				</button>
			</div>
			<div className="flex items-center gap-2" onKeyDown={submitOnEnter}>
				<input className="input min-h-10 min-w-0 flex-1" placeholder="Details (z.B. 500 g)" aria-label="Details" value={details} onChange={(event) => setDetails(event.target.value)} />
				<TagPicker tags={tags} value={tagIds} onChange={setTagIds} sizeClass="size-10" />
			</div>
		</fieldset>
	)
}
