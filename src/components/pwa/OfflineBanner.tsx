"use client"

import { useOnline, usePendingCount } from "@/lib/offline/toggles"

// Hinweis ohne Verbindung bzw. solange Änderungen noch nicht gesendet sind
export default function OfflineBanner() {
	const online = useOnline()
	const pending = usePendingCount()
	if (online && pending === 0) return null
	return (
		<div role="status" className="notice mb-4 text-sm">
			{online
				? `${pending} ${pending === 1 ? "Änderung wird" : "Änderungen werden"} synchronisiert …`
				: `Offline – du siehst den zuletzt gespeicherten Stand. Abhaken geht weiter und wird später synchronisiert${pending ? ` (${pending} offen)` : ""}.`}
		</div>
	)
}
