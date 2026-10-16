"use client"

import { useId, useState } from "react"

const LOCAL_PREFIX = "/api/images/"
const MAX_EDGE = 1600

// Handyfotos vor dem Upload verkleinern: spart Speicher und umgeht Upload-Limits (z.B. nginx)
const shrinkImage = async (file: File): Promise<Blob> => {
	if (file.type === "image/gif") return file // Animation erhalten
	const bitmap = await createImageBitmap(file).catch(() => null)
	if (!bitmap) return file
	const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
	if (scale === 1 && file.size < 2 * 1024 * 1024) return file

	const canvas = document.createElement("canvas")
	canvas.width = Math.round(bitmap.width * scale)
	canvas.height = Math.round(bitmap.height * scale)
	canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
	const type = file.type === "image/png" ? "image/png" : "image/jpeg"
	return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob ?? file), type, 0.85))
}

export default function ImageField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
	const inputId = useId()
	const [uploading, setUploading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [brokenPreview, setBrokenPreview] = useState<string | null>(null)
	const isLocal = value.startsWith(LOCAL_PREFIX)

	const upload = async (file: File) => {
		setUploading(true)
		setError(null)
		try {
			const body = new FormData()
			body.append("file", await shrinkImage(file), file.name)
			const response = await fetch("/api/images", { method: "POST", body })
			const data = await response.json().catch(() => ({ error: `Upload fehlgeschlagen (HTTP ${response.status})` }))
			if (!response.ok) throw new Error(data.error)
			onChange(data.url)
		} catch (uploadError) {
			setError(uploadError instanceof Error ? uploadError.message : "Upload fehlgeschlagen")
		} finally {
			setUploading(false)
		}
	}

	return (
		<div className="flex gap-3">
			<div className="flex size-28 shrink-0 items-center justify-center overflow-hidden rounded border border-(--border) bg-emerald-50 sm:size-32 dark:bg-emerald-950">
				{value && brokenPreview !== value ? (
					// eslint-disable-next-line @next/next/no-img-element
					<img src={value} alt="Vorschau" className="size-full object-cover" onError={() => setBrokenPreview(value)} />
				) : (
					<span className="px-2 text-center text-xs opacity-60">{value ? "Keine Vorschau möglich" : "Kein Bild"}</span>
				)}
			</div>
			<div className="flex min-w-0 flex-1 flex-col gap-2">
				<label htmlFor={inputId}>Bild</label>
				<input
					id={inputId}
					type="text"
					inputMode="url"
					// lokal gespeicherte Bilder zeigen keinen internen Pfad – neue URL ersetzt das Bild
					value={isLocal ? "" : value}
					placeholder={isLocal ? "Gespeichertes Bild – URL einfügen, um es zu ersetzen" : "https://… (wird beim Speichern heruntergeladen)"}
					onChange={(event) => {
						setError(null)
						onChange(event.target.value)
					}}
				/>
				<div className="flex flex-wrap items-center gap-3 text-sm">
					<label className="btn-secondary cursor-pointer">
						{uploading ? "Lädt hoch…" : "Bild hochladen"}
						<input
							type="file"
							accept="image/jpeg,image/png,image/webp,image/gif"
							className="sr-only"
							disabled={uploading}
							onChange={(event) => {
								const file = event.target.files?.[0]
								if (file) upload(file)
								event.target.value = ""
							}}
						/>
					</label>
					{value && (
						<button type="button" className="btn-link" onClick={() => onChange("")}>
							Bild entfernen
						</button>
					)}
				</div>
				{error && <p className="error">{error}</p>}
			</div>
		</div>
	)
}
