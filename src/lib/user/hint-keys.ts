// Einmal-Hinweise der App (Schlüssel wie in <Hint id=…>)
export const KNOWN_HINTS = ["shop-basics", "month-days"]

// Hinweise gelten als eingeschaltet, solange nicht alle weggeklickt sind
export const hintsEnabled = (dismissed: string[]) => !KNOWN_HINTS.every((key) => dismissed.includes(key))
