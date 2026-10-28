"use client"

import ProductInput from "@/components/shop/ProductInput"
import TagPicker from "@/components/tags/TagPicker"
import Icon from "@/components/ui/Icon"
import type { CategoryDTO, ProductMemoryDTO } from "@/lib/grocery/categories"
import type { TagDTO } from "@/lib/tags/icons"
import { useState, type ReactNode, type Ref } from "react"

export type NewItem = { name: string; details: string; categoryId: string | null; tagIds: string[] }

type AddItemFormProps = {
	memory: ProductMemoryDTO[]
	categories: CategoryDTO[]
	tags: TagDTO[]
	placeholder: string
	// true = gespeichert (Felder werden geleert), false = Fehler (Eingabe bleibt stehen)
	onAdd: (item: NewItem) => Promise<boolean>
	disabled?: boolean
	disabledTitle?: string
	// weitere Felder in der aufgeklappten Zeile (z.B. Auswahl der Liste)
	extra?: ReactNode
	formRef?: Ref<HTMLFormElement>
}

// Produkt hinzufügen (Einkaufsliste, Gericht): einzeilig mit „+“, Details/Tags erst beim Eingeben.
// Ein gewählter Vorschlag wird direkt hinzugefügt.
export default function AddItemForm({ memory, categories, tags, placeholder, onAdd, disabled = false, disabledTitle, extra, formRef }: AddItemFormProps) {
	const [name, setName] = useState("")
	const [details, setDetails] = useState("")
	// Kategorie aus einem gewählten Vorschlag; weitertippen setzt sie zurück
	const [pickedCategory, setPickedCategory] = useState<string | null>(null)
	const [tagIds, setTagIds] = useState<string[]>([])
	const [focused, setFocused] = useState(false)
	const expanded = focused || !!name || !!details || tagIds.length > 0

	const add = async (itemName: string, categoryId: string | null) => {
		if (!(await onAdd({ name: itemName, details, categoryId, tagIds }))) return
		setName("")
		setDetails("")
		setPickedCategory(null)
		setTagIds([])
	}

	return (
		<form
			ref={formRef}
			className="space-y-2"
			onFocus={() => setFocused(true)}
			onBlur={(event) => {
				if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
				// erst nach dem Antippen einklappen: sonst rutscht der Inhalt mitten im Tippen weg und der Tipp landet daneben
				let done = false
				const collapse = () => {
					if (done) return
					done = true
					window.removeEventListener("click", collapse, true)
					setTimeout(() => setFocused(false), 0)
				}
				window.addEventListener("click", collapse, true)
				setTimeout(collapse, 700)
			}}
			onSubmit={async (event) => {
				event.preventDefault()
				await add(name, pickedCategory)
			}}
		>
			<div className="flex gap-2">
				<ProductInput
					className="min-w-0 flex-1"
					inputClassName="min-h-10"
					placeholder={placeholder}
					value={name}
					onChange={(value) => {
						setName(value)
						setPickedCategory(null)
					}}
					// Vorschlag gewählt: direkt hinzufügen (mit eventuell schon eingetragenen Details und Tags)
					onPick={(suggestion) => {
						if (!disabled) return void add(suggestion.displayName, suggestion.categoryId)
						setName(suggestion.displayName)
						setPickedCategory(suggestion.categoryId)
					}}
					memory={memory}
					categories={categories}
					dropUp
				/>
				<button
					type="submit"
					className="btn flex size-10 shrink-0 items-center justify-center px-0"
					aria-label="Hinzufügen"
					disabled={disabled}
					title={disabled ? disabledTitle : "Hinzufügen"}
				>
					<Icon name="plus" />
				</button>
			</div>
			{expanded && (
				<div className="flex gap-2">
					<input className="input min-h-10 min-w-0 flex-1" placeholder="Details (z.B. 500 g)" aria-label="Details" value={details} onChange={(event) => setDetails(event.target.value)} />
					{extra}
					<TagPicker tags={tags} value={tagIds} onChange={setTagIds} sizeClass="size-10" />
				</div>
			)}
		</form>
	)
}
