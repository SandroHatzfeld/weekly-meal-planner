"use client"

import TagIcon from "@/components/tags/TagIcon"
import type { TagDTO } from "@/lib/tags/icons"
import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { createPortal } from "react-dom"

export type EditableItem = { id: string; name: string; details: string | null; listId: string; tagIds: string[] }
export type ItemChanges = { name: string; details: string; listId: string; tagIds: string[] }

type ItemEditDialogProps<T extends EditableItem> = {
	item: T | null
	lists: { id: string; name: string }[]
	tags: TagDTO[]
	onSave: (item: T, changes: ItemChanges) => void | Promise<void>
	onDelete?: (item: T) => Promise<void> // ohne: kein Löschen-Button
	onClose: () => void
}

export default function ItemEditDialog<T extends EditableItem>({ item, lists, tags, onSave, onDelete, onClose }: ItemEditDialogProps<T>) {
	const dialog = useRef<HTMLDialogElement>(null)
	const pressedOnBackdrop = useRef(false)
	// Portal erst im Browser (beim Server-Rendering gibt es kein document)
	const isClient = useSyncExternalStore(
		() => () => {},
		() => true,
		() => false,
	)

	useEffect(() => {
		if (item && !dialog.current?.open) dialog.current?.showModal()
		if (!item && dialog.current?.open) dialog.current.close()
	}, [item, isClient])

	if (!isClient) return null

	// Portal an <body>: der Dialog enthält ein eigenes Formular und wird auch innerhalb anderer Formulare genutzt
	return createPortal(
		<dialog
			ref={dialog}
			onClose={onClose}
			// Klick auf den abgedunkelten Hintergrund schließt – aber nur, wenn der Druck dort auch begann.
			// Sonst würde das Loslassen nach dem Gedrückthalten auf der Kachel das Popup sofort wieder schließen.
			onPointerDown={(event) => {
				pressedOnBackdrop.current = event.target === dialog.current
			}}
			onClick={(event) => {
				if (event.target === dialog.current && pressedOnBackdrop.current) dialog.current?.close()
				pressedOnBackdrop.current = false
			}}
			// mobil oben andocken (Tastatur verdeckt sonst die Hälfte), ab sm mittig
			className="mx-auto mt-3 mb-auto max-h-[calc(100dvh-1.5rem)] w-[min(26rem,calc(100%-2rem))] overflow-y-auto rounded-xl sm:my-auto border border-(--border) bg-(--surface) p-0 text-(--foreground) shadow-xl backdrop:bg-black/40"
		>
			{/* key: Formular bei jedem geöffneten Eintrag frisch initialisieren */}
			{item && <EditForm key={item.id} item={item} lists={lists} tags={tags} onSave={onSave} onDelete={onDelete} close={() => dialog.current?.close()} />}
		</dialog>,
		document.body,
	)
}

function EditForm<T extends EditableItem>({
	item,
	lists,
	tags,
	onSave,
	onDelete,
	close,
}: Omit<ItemEditDialogProps<T>, "item" | "onClose"> & { item: T; close: () => void }) {
	const [name, setName] = useState(item.name)
	const [details, setDetails] = useState(item.details ?? "")
	const [listId, setListId] = useState(item.listId)
	const [tagIds, setTagIds] = useState(item.tagIds)
	const [saving, setSaving] = useState(false)

	return (
		<form
			className="form max-w-none gap-3 p-4"
			onSubmit={async (event) => {
				event.preventDefault()
				// React-Events laufen auch durch Portale nach oben – das äußere Formular (Planen) nicht mit absenden
				event.stopPropagation()
				setSaving(true)
				await onSave(item, { name, details, listId, tagIds })
				setSaving(false)
				close()
			}}
		>
			<h2 className="text-lg font-semibold">Eintrag bearbeiten</h2>
			<label htmlFor="item-name">Name</label>
			<input id="item-name" value={name} onChange={(event) => setName(event.target.value)} required autoFocus />
			<label htmlFor="item-details">Menge / Info</label>
			<input id="item-details" value={details} placeholder="z.B. 500 g" onChange={(event) => setDetails(event.target.value)} />
			{lists.length > 1 && (
				<>
					<label htmlFor="item-list">Liste</label>
					<select id="item-list" className="input" value={listId} onChange={(event) => setListId(event.target.value)}>
						{lists.map((list) => (
							<option key={list.id} value={list.id}>
								{list.name}
							</option>
						))}
					</select>
				</>
			)}
			{tags.length > 0 && (
				<fieldset>
					<legend className="mb-1 text-sm font-medium">Tags</legend>
					<div className="flex flex-wrap gap-2">
						{tags.map((tag) => {
							const active = tagIds.includes(tag.id)
							return (
								<button
									key={tag.id}
									type="button"
									aria-pressed={active}
									onClick={() => setTagIds(active ? tagIds.filter((id) => id !== tag.id) : [...tagIds, tag.id])}
									className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm ${active ? "border-emerald-600 bg-emerald-700 text-white" : "border-(--border) bg-(--surface)"}`}
								>
									<TagIcon icon={tag.icon} />
									{tag.name}
								</button>
							)
						})}
					</div>
				</fieldset>
			)}
			<div className="mt-2 flex items-center gap-2">
				<button type="submit" disabled={saving}>
					Speichern
				</button>
				<button type="button" className="btn-secondary" onClick={close}>
					Abbrechen
				</button>
				{onDelete && (
					<button
						type="button"
						className="btn-danger ml-auto"
						disabled={saving}
						onClick={async () => {
							await onDelete(item)
							close()
						}}
					>
						Löschen
					</button>
				)}
			</div>
		</form>
	)
}
