"use client"

import ItemEditDialog from "@/components/items/ItemEditDialog"
import ItemTile from "@/components/items/ItemTile"
import type { IngredientEntry } from "@/lib/recipes/planning"
import type { CategoryDTO } from "@/lib/grocery/categories"
import type { TagDTO } from "@/lib/tags/icons"
import { useState } from "react"

type IngredientPickerProps = {
	entries: IngredientEntry[]
	onChange: (entries: IngredientEntry[]) => void
	lists: { id: string; name: string }[]
	tags: TagDTO[]
	categories?: CategoryDTO[]
	defaultListId: string
	className?: string
}

// Zutatenauswahl beim Planen im Kachel-Design der Einkaufsliste:
// Tippen = (nicht) übernehmen, Gedrückthalten = Name/Menge/Liste/Tags für den Listeneintrag anpassen
export default function IngredientPicker({ entries, onChange, lists, tags, categories = [], defaultListId, className = "" }: IngredientPickerProps) {
	const [editingId, setEditingId] = useState<string | null>(null)
	const editing = entries.find((entry) => entry.id === editingId)
	const update = (id: string, patch: Partial<IngredientEntry>) =>
		onChange(entries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)))

	if (entries.length === 0) return <p className="text-sm opacity-60">Das Rezept hat keine Zutaten.</p>

	const selectedCount = entries.filter((entry) => entry.selected).length

	return (
		<fieldset>
			<legend className="mb-1 text-sm">
				Auf die Einkaufsliste ({selectedCount}/{entries.length})
			</legend>
			<ul className={`grid grid-cols-2 gap-2 ${className}`}>
				{entries.map((entry) => (
					<li key={entry.id} className="flex">
						<ItemTile
							item={entry}
							tags={tags}
							dimmed={!entry.selected}
							pressed={entry.selected}
							hint="Tippen: übernehmen ja/nein · gedrückt halten oder Rechtsklick zum Bearbeiten"
							onToggle={() => update(entry.id, { selected: !entry.selected })}
							onEdit={() => setEditingId(entry.id)}
						/>
					</li>
				))}
			</ul>
			<p className="mt-1 text-xs opacity-60">Gedrückt halten, um Menge, Liste oder Tags anzupassen.</p>

			<ItemEditDialog
				item={editing ? { ...editing, listId: editing.listId ?? defaultListId, categoryId: editing.categoryId ?? undefined } : null}
				lists={lists}
				tags={tags}
				categories={categories}
				onClose={() => setEditingId(null)}
				onSave={(item, changes) =>
					update(item.id, {
						name: changes.name.trim() || item.name,
						details: changes.details.trim() || null,
						// Standardliste nicht fest übernehmen, damit ein späterer Wechsel der Standardliste weiter greift
						listId: changes.listId === defaultListId ? null : changes.listId,
						tagIds: changes.tagIds,
						// "automatisch" = beim Planen die gemerkte Kategorie des Produkts verwenden
						categoryId: changes.categoryId ?? null,
						// wer eine Zutat bearbeitet, will sie auch übernehmen
						selected: true,
					})
				}
			/>
		</fieldset>
	)
}
