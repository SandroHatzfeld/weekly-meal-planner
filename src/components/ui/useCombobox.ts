"use client"

import { useId, useState, type KeyboardEvent } from "react"

// Tastatur- und ARIA-Logik für Eingabefelder mit Vorschlagsliste (Rezepte, Produkte):
// ↑/↓ wählt, Enter übernimmt, Escape schließt zuerst nur die Vorschläge.
export const useCombobox = <T>(items: T[], onPick: (item: T) => void) => {
	const listboxId = useId()
	const [activeIndex, setActiveIndex] = useState(-1)
	const [dismissed, setDismissed] = useState(false)
	const visible = dismissed ? [] : items
	const active = activeIndex < visible.length ? activeIndex : -1

	const pick = (item: T) => {
		setActiveIndex(-1)
		onPick(item)
	}

	return {
		visible,
		// beim Tippen: Auswahl zurücksetzen und Vorschläge wieder zeigen
		reset: () => {
			setActiveIndex(-1)
			setDismissed(false)
		},
		inputProps: {
			role: "combobox" as const,
			"aria-autocomplete": "list" as const,
			"aria-expanded": visible.length > 0,
			"aria-controls": listboxId,
			"aria-activedescendant": active >= 0 ? `${listboxId}-${active}` : undefined,
			onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
				if (event.key === "ArrowDown" && visible.length) {
					event.preventDefault()
					setActiveIndex((active + 1) % visible.length)
				} else if (event.key === "ArrowUp" && visible.length) {
					event.preventDefault()
					setActiveIndex(active <= 0 ? visible.length - 1 : active - 1)
				} else if (event.key === "Enter" && active >= 0) {
					event.preventDefault()
					pick(visible[active])
				} else if (event.key === "Escape" && visible.length) {
					// nicht gleich das Popup/Formular schließen
					event.preventDefault()
					setDismissed(true)
				}
			},
		},
		listboxProps: { id: listboxId, role: "listbox" as const },
		optionProps: (index: number) => ({
			id: `${listboxId}-${index}`,
			role: "option" as const,
			"aria-selected": index === active,
			className: index === active ? "active" : "",
			// mousedown statt click, damit das Input den Fokus nicht vorher verliert
			onMouseDown: (event: { preventDefault: () => void }) => {
				event.preventDefault()
				pick(visible[index])
				// nach der Auswahl das Feld verlassen, damit auf dem Handy die Tastatur verschwindet
				const field = document.activeElement
				if (field instanceof HTMLElement && field.getAttribute("role") === "combobox") field.blur()
			},
		}),
	}
}
