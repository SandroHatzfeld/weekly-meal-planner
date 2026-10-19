"use client"

import RecipeForm from "@/components/recipes/RecipeForm"
import { importRecipeFromUrl, type RecipeInput } from "@/lib/recipes/actions"
import { useState, useTransition } from "react"

// Neues oder bestehendes Rezept: optional per Link befüllen. Das Formular zeigt das aufbereitete Rezept zur Kontrolle,
// gespeichert wird erst dort. Beim Bearbeiten ersetzt der Import die Felder im Formular, gespeichert ist noch nichts.
export default function RecipeWithImport({ importEnabled, recipeId, initial }: { importEnabled: boolean; recipeId?: string; initial?: RecipeInput }) {
	const [url, setUrl] = useState(initial?.sourceUrl ?? "")
	const [imported, setImported] = useState<{ recipe: RecipeInput; version: number } | null>(null)
	const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null)
	const [pending, startTransition] = useTransition()

	const run = (refresh: boolean) =>
		startTransition(async () => {
			setMessage(null)
			const result = await importRecipeFromUrl(url, refresh)
			if ("error" in result) return setMessage({ text: result.error, error: true })
			// bestehendes Bild behalten (ein importiertes würde das eigene beim Speichern ersetzen)
			const recipe = initial?.imageUrl ? { ...result.recipe, imageUrl: initial.imageUrl } : result.recipe
			setImported((current) => ({ recipe, version: (current?.version ?? 0) + 1 }))
			setMessage({
				text: `${result.cached ? "Aus dem Zwischenspeicher geladen" : "Rezept geladen"} – bitte prüfen und speichern${recipeId ? " (ersetzt dann dieses Rezept)" : ""}.`,
			})
		})

	return (
		<div className="space-y-4">
			{importEnabled && (
				<form
					className="space-y-2"
					onSubmit={(event) => {
						event.preventDefault()
						run(false)
					}}
				>
					<label htmlFor="import-url" className="font-semibold">
						Rezept von Link importieren
					</label>
					<div className="flex flex-wrap gap-2">
						<input
							id="import-url"
							type="url"
							className="input min-w-0 flex-1 basis-full sm:basis-0"
							placeholder="https://… (Link zu einem Rezept)"
							value={url}
							onChange={(event) => setUrl(event.target.value)}
							required
						/>
						<button type="submit" className="btn" disabled={pending}>
							{pending ? "Lade …" : "Importieren"}
						</button>
						{(imported || (recipeId && initial?.sourceUrl)) && (
							<button type="button" className="btn-secondary" disabled={pending} onClick={() => run(true)}>
								Neu laden
							</button>
						)}
					</div>
					<p className="text-xs opacity-60">
						Die Seite wird auf dem Server geladen und von einem Sprachmodell in das einheitliche Format gebracht (Zutaten mit Details, einzelne Schritte).
					</p>
					{message && <p className={message.error ? "error" : "notice"}>{message.text}</p>}
				</form>
			)}
			{/* key: neuer Import baut das Formular mit den neuen Werten neu auf */}
			<RecipeForm key={imported?.version ?? 0} recipeId={recipeId} initial={imported?.recipe ?? initial} />
		</div>
	)
}
