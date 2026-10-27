"use client"

import Link from "next/link"
import { useEffect } from "react"

// Fehler beim Laden einer Seite: verständliche Meldung statt der Standard-Fehlerseite
export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
	useEffect(() => {
		console.error(error)
	}, [error])

	const offline = typeof navigator !== "undefined" && !navigator.onLine
	return (
		<div role="alert" className="mx-auto max-w-md space-y-4 py-12 text-center">
			<h2 className="text-xl font-semibold">{offline ? "Keine Verbindung" : "Da ist etwas schiefgelaufen"}</h2>
			<p className="opacity-80">
				{offline
					? "Diese Seite ist offline nicht verfügbar. Die Einkaufsliste funktioniert auch ohne Netz."
					: "Die Seite konnte nicht geladen werden. Versuch es gleich noch einmal."}
			</p>
			<div className="flex justify-center gap-2">
				<button type="button" className="btn min-h-11" onClick={retry}>
					Erneut versuchen
				</button>
				<Link href="/shop" className="btn-secondary inline-flex min-h-11 items-center">
					Zur Einkaufsliste
				</Link>
			</div>
		</div>
	)
}
