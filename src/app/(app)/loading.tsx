// Sofort sichtbar, während eine Seite vom Server kommt (z.B. Rezept, Gericht, Einstellungen)
export default function Loading() {
	return (
		<div role="status" aria-live="polite" className="flex justify-center py-16">
			<span className="size-8 animate-spin rounded-full border-4 border-emerald-600/25 border-t-emerald-600" aria-hidden="true" />
			<span className="sr-only">Lädt …</span>
		</div>
	)
}
