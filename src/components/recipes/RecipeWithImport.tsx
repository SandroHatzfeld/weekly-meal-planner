"use client"

import RecipeForm from "@/components/recipes/RecipeForm"
import { finishRecipeImport, prepareRecipeImport, type RecipeInput } from "@/lib/recipes/actions"
import { useEffect, useRef, useState } from "react"

type Status =
	| { step: "idle" }
	| { step: "loading" } // 1/2 Seite wird geladen
	| { step: "structuring"; since: number } // 2/2 Sprachmodell arbeitet
	| { step: "done"; cached: boolean }
	| { step: "error"; text: string }

// Neues oder bestehendes Rezept: optional per Link befüllen. Das Formular zeigt das aufbereitete Rezept zur Kontrolle,
// gespeichert wird erst dort. Beim Bearbeiten ersetzt der Import die Felder im Formular, gespeichert ist noch nichts.
export default function RecipeWithImport({ importEnabled, recipeId, initial }: { importEnabled: boolean; recipeId?: string; initial?: RecipeInput }) {
	const [url, setUrl] = useState(initial?.sourceUrl ?? "")
	const [imported, setImported] = useState<{ recipe: RecipeInput; version: number } | null>(null)
	const [status, setStatus] = useState<Status>({ step: "idle" })
	const [seconds, setSeconds] = useState(0)
	const running = useRef(false)
	const busy = status.step === "loading" || status.step === "structuring"

	// Sekundenzähler, solange das Sprachmodell arbeitet (es meldet selbst keinen Fortschritt)
	const since = status.step === "structuring" ? status.since : null
	useEffect(() => {
		if (since === null) return
		const tick = () => setSeconds(Math.floor((Date.now() - since) / 1000))
		tick()
		const timer = setInterval(tick, 1000)
		return () => clearInterval(timer)
	}, [since])

	const run = async (refresh: boolean) => {
		if (running.current) return
		running.current = true
		try {
			setStatus({ step: "loading" })
			const prepared = await prepareRecipeImport(url, refresh)
			if ("error" in prepared) return setStatus({ step: "error", text: prepared.error })
			if (!prepared.ready) setStatus({ step: "structuring", since: Date.now() })
			const result = await finishRecipeImport(url)
			if ("error" in result) return setStatus({ step: "error", text: result.error })
			// bestehendes Bild behalten (ein importiertes würde das eigene beim Speichern ersetzen)
			const recipe = initial?.imageUrl ? { ...result.recipe, imageUrl: initial.imageUrl } : result.recipe
			setImported((current) => ({ recipe, version: (current?.version ?? 0) + 1 }))
			setStatus({ step: "done", cached: result.cached })
		} finally {
			running.current = false
		}
	}

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
						<button type="submit" className="btn" disabled={busy}>
							Importieren
						</button>
						{(imported || (recipeId && initial?.sourceUrl)) && (
							<button type="button" className="btn-secondary" disabled={busy} onClick={() => run(true)}>
								Neu laden
							</button>
						)}
						<ImportStatus status={status} seconds={seconds} replaces={!!recipeId} />
					</div>
				</form>
			)}
			{/* key: neuer Import baut das Formular mit den neuen Werten neu auf */}
			<RecipeForm key={imported?.version ?? 0} recipeId={recipeId} initial={imported?.recipe ?? initial} />
		</div>
	)
}

// Status neben den Buttons; umbricht auf schmalen Bildschirmen in die nächste Zeile
function ImportStatus({ status, seconds, replaces }: { status: Status; seconds: number; replaces: boolean }) {
	let text: string | null = null
	if (status.step === "loading") text = "1/2 Seite wird geladen …"
	if (status.step === "structuring") text = `2/2 Rezept wird aufbereitet … ${seconds} s`
	if (status.step === "done") text = `${status.cached ? "Aus dem Zwischenspeicher geladen" : "Fertig"} – bitte prüfen und speichern${replaces ? " (ersetzt dann dieses Rezept)" : ""}`
	if (status.step === "error") text = status.text
	return (
		<p
			role={status.step === "error" ? "alert" : "status"}
			aria-live="polite"
			className={`flex min-w-0 items-center gap-2 py-2 text-sm ${status.step === "error" ? "text-red-600" : status.step === "done" ? "text-emerald-600" : "opacity-80"}`}
		>
			{(status.step === "loading" || status.step === "structuring") && (
				<span className="size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
			)}
			{text}
		</p>
	)
}
