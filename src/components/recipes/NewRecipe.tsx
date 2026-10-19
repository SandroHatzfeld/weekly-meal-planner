"use client"

import RecipeForm from "@/components/recipes/RecipeForm"
import { importRecipeFromUrl, type RecipeInput } from "@/lib/recipes/actions"
import { useState, useTransition } from "react"

// Neues Rezept: optional per Link vorbefüllen. Das Formular zeigt das aufbereitete Rezept zur Kontrolle, gespeichert wird dort.
export default function NewRecipe({ importEnabled }: { importEnabled: boolean }) {
	const [url, setUrl] = useState("")
	const [imported, setImported] = useState<{ recipe: RecipeInput; version: number } | null>(null)
	const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null)
	const [pending, startTransition] = useTransition()

	const run = (refresh: boolean) =>
		startTransition(async () => {
			setMessage(null)
			const result = await importRecipeFromUrl(url, refresh)
			if ("error" in result) return setMessage({ text: result.error, error: true })
			setImported((current) => ({ recipe: result.recipe, version: (current?.version ?? 0) + 1 }))
			setMessage({ text: `${result.cached ? "Aus dem Zwischenspeicher geladen" : "Rezept geladen"} – bitte prüfen und speichern.` })
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
						{imported && (
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
			<RecipeForm key={imported?.version ?? 0} initial={imported?.recipe} />
		</div>
	)
}
