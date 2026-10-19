"use client"

import { usePlanEvent } from "@/components/realtime/SocketProvider"
import type { GroceryItemDTO } from "@/lib/dto"
import type { ProductMemoryDTO } from "@/lib/grocery/categories"
import { normalizeItemName } from "@/lib/grocery/normalize"
import { useState } from "react"

// bekannte Produkte für die Vorschläge – neue/geänderte Einträge (auch von anderen Mitgliedern) live ergänzen
export const useProductMemory = (initial: ProductMemoryDTO[]) => {
	const [memory, setMemory] = useState(initial)
	const [synced, setSynced] = useState(initial)
	if (synced !== initial) {
		setSynced(initial)
		setMemory(initial)
	}

	// wie auf dem Server: Kategorie des Eintrags wird Hauptkategorie, weitere bleiben dahinter
	const learn = (item: GroceryItemDTO) =>
		setMemory((current) => {
			const key = normalizeItemName(item.name)
			// ein alternativer Name gehört zum Hauptprodukt (Schreibweise bleibt dessen), es entsteht kein neuer Eintrag
			const match = current.find((entry) => normalizeItemName(entry.displayName) === key || entry.aliases.some((alias) => normalizeItemName(alias) === key))
			const known = match?.categoryIds ?? []
			const categoryIds = item.categoryId ? [item.categoryId, ...known.filter((id) => id !== item.categoryId)] : known
			const isAlias = !!match && normalizeItemName(match.displayName) !== key
			return [
				{ displayName: isAlias ? match.displayName : item.name, categoryIds, usedAt: new Date().toISOString(), aliases: match?.aliases ?? [] },
				...current.filter((entry) => entry !== match),
			]
		})

	usePlanEvent("grocery-item-created", learn)
	usePlanEvent("grocery-item-updated", learn)
	usePlanEvent("grocery-item-moved", ({ item }) => learn(item))
	return { memory, learn }
}
