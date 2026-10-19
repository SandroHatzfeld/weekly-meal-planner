"use client"

import { importProductsCsv } from "@/lib/grocery/actions"
import type { CategoryDTO, ProductMemoryDTO } from "@/lib/grocery/categories"
import { productsToCsv } from "@/lib/grocery/csv"
import type { ImportSummary } from "@/lib/grocery/productImport"
import { useRouter } from "next/navigation"
import { useRef, useState, useTransition } from "react"

const describe = (summary: ImportSummary) =>
	[
		`${summary.total} Produkte in der Datei`,
		`${summary.created} neu`,
		`${summary.changed} geändert`,
		`${summary.deleted} werden gelöscht`,
		summary.aliases ? `${summary.aliases} alternative Namen` : null,
		summary.skippedAliases.length ? `übersprungene Alternativen (Name schon vergeben): ${summary.skippedAliases.slice(0, 8).join(", ")}${summary.skippedAliases.length > 8 ? " …" : ""}` : null,
		summary.newCategories.length ? `neue Kategorien: ${summary.newCategories.join(", ")}` : null,
	]
		.filter(Boolean)
		.join("\n")

// Produkte samt Kategorien als CSV herunterladen und bearbeitet wieder hochladen (ersetzt die Produktliste)
export default function ProductCsv({ planId, categories, products }: { planId: string; categories: CategoryDTO[]; products: ProductMemoryDTO[] }) {
	const router = useRouter()
	const fileInput = useRef<HTMLInputElement>(null)
	const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null)
	const [pending, startTransition] = useTransition()

	const download = () => {
		const names = new Map(categories.map((category) => [category.id, category.name]))
		const csv = productsToCsv(
			products.map((product) => ({
				displayName: product.displayName,
				aliases: product.aliases,
				categories: product.categoryIds.map((id) => names.get(id)).filter((name): name is string => !!name),
			})),
		)
		const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
		const link = document.createElement("a")
		link.href = url
		link.download = `produkte-${new Date().toISOString().slice(0, 10)}.csv`
		link.click()
		URL.revokeObjectURL(url)
	}

	const upload = (file: File) =>
		startTransition(async () => {
			setMessage(null)
			const csv = await file.text()
			const preview = await importProductsCsv(planId, csv, false)
			if (preview.error || !preview.summary) return setMessage({ text: preview.error ?? "Import fehlgeschlagen", error: true })
			if (!confirm(`${describe(preview.summary)}\n\nImport übernehmen?`)) return
			const result = await importProductsCsv(planId, csv, true)
			if (result.error || !result.summary) return setMessage({ text: result.error ?? "Import fehlgeschlagen", error: true })
			setMessage({ text: `Importiert: ${describe(result.summary).replaceAll("\n", " · ").replace("werden gelöscht", "gelöscht")}` })
			router.refresh()
		})

	return (
		<div className="space-y-1">
			<div className="flex flex-wrap gap-2">
				<button type="button" className="btn-secondary" onClick={download}>
					CSV exportieren
				</button>
				<button type="button" className="btn-secondary" disabled={pending} onClick={() => fileInput.current?.click()}>
					{pending ? "Importiere…" : "CSV importieren"}
				</button>
				<input
					ref={fileInput}
					type="file"
					accept=".csv,text/csv"
					className="hidden"
					aria-label="CSV-Datei importieren"
					onChange={(event) => {
						const file = event.target.files?.[0]
						event.target.value = "" // dieselbe Datei erneut wählbar
						if (file) upload(file)
					}}
				/>
			</div>
			<p className="text-xs opacity-60">
				Eine Zeile pro Produkt: <code>Produkt;Kategorie 1;Kategorie 2;…</code> – die erste Kategorie ist die Hauptkategorie. Der Import ersetzt die
				Produktliste: Produkte, die in der Datei fehlen, werden gelöscht.
			</p>
			{message && <p className={message.error ? "error" : "notice"}>{message.text}</p>}
		</div>
	)
}
