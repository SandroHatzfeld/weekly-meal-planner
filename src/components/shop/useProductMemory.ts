"use client"

import { usePlanEvent } from "@/components/realtime/SocketProvider"
import type { GroceryItemDTO } from "@/lib/dto"
import type { ProductMemoryDTO } from "@/lib/grocery/categories"
import { normalizeItemName } from "@/lib/grocery/normalize"
import { useState } from "react"

// bekannte Produkte für die Vorschläge – neue/geänderte Einträge (auch von anderen Mitgliedern) live ergänzen
export const useProductMemory = (initial: ProductMemoryDTO[]) => {
	const [memory, setMemory] = useState(initial)

	const learn = (item: GroceryItemDTO) =>
		setMemory((current) => [
			{ listId: item.listId, displayName: item.name, categoryId: item.categoryId, usedAt: new Date().toISOString() },
			...current.filter((entry) => !(entry.listId === item.listId && normalizeItemName(entry.displayName) === normalizeItemName(item.name))),
		])

	usePlanEvent("grocery-item-created", learn)
	usePlanEvent("grocery-item-updated", learn)
	usePlanEvent("grocery-item-moved", ({ item }) => learn(item))
	return { memory, learn }
}
