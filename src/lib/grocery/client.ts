import type { ItemChanges } from "@/components/items/ItemEditDialog"
import type { GroceryItemDTO } from "../dto"
import { editGroceryItem, moveGroceryItem, setGroceryItemCategory, setGroceryItemTags } from "./actions"

// Änderungen aus dem Bearbeiten-Popup speichern – nur was sich wirklich geändert hat.
// Gemeinsam genutzt von Einkaufsliste und Gericht-Seite.
export const applyItemChanges = async (item: GroceryItemDTO, changes: ItemChanges) => {
	let updated = item
	if (changes.name.trim() !== item.name || (changes.details.trim() || null) !== item.details) {
		updated = (await editGroceryItem(item.id, changes.name, changes.details)) ?? updated
	}
	const sameTags = changes.tagIds.length === item.tagIds.length && changes.tagIds.every((id) => item.tagIds.includes(id))
	if (!sameTags) updated = await setGroceryItemTags(item.id, changes.tagIds)
	// erst verschieben (sortiert in der neuen Liste automatisch ein), dann ggf. Kategorie setzen
	if (changes.listId !== item.listId) updated = await moveGroceryItem(item.id, changes.listId)
	if (changes.categoryId !== undefined && changes.categoryId !== updated.categoryId) {
		updated = await setGroceryItemCategory(item.id, changes.categoryId)
	}
	return updated
}
