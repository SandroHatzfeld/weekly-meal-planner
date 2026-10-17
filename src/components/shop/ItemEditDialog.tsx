"use client"

import TagIcon from "@/components/tags/TagIcon"
import type { GroceryItemDTO } from "@/lib/dto"
import type { TagDTO } from "@/lib/tags/icons"
import { useEffect, useRef, useState } from "react"

type ItemEditDialogProps = {
	item: GroceryItemDTO | null
	lists: { id: string; name: string }[]
	tags: TagDTO[]
	onSave: (item: GroceryItemDTO, changes: { name: string; details: string; listId: string; tagIds: string[] }) => Promise<void>
	onDelete: (item: GroceryItemDTO) => Promise<void>
	onClose: () => void
}

export default function ItemEditDialog({ item, lists, tags, onSave, onDelete, onClose }: ItemEditDialogProps) {
	const dialog = useRef<HTMLDialogElement>(null)

	useEffect(() => {
		if (item && !dialog.current?.open) dialog.current?.showModal()
		if (!item && dialog.current?.open) dialog.current.close()
	}, [item])

	return (
		<dialog
			ref={dialog}
			onClose={onClose}
			// Klick auf den abgedunkelten Hintergrund schließt
			onClick={(event) => {
				if (event.target === dialog.current) dialog.current?.close()
			}}
			className="m-auto w-[min(26rem,calc(100%-2rem))] rounded-xl border border-(--border) bg-(--surface) p-0 text-(--foreground) shadow-xl backdrop:bg-black/40"
		>
			{/* key: Formular bei jedem geöffneten Eintrag frisch initialisieren */}
			{item && <EditForm key={item.id} item={item} lists={lists} tags={tags} onSave={onSave} onDelete={onDelete} close={() => dialog.current?.close()} />}
		</dialog>
	)
}

function EditForm({
	item,
	lists,
	tags,
	onSave,
	onDelete,
	close,
}: Omit<ItemEditDialogProps, "item" | "onClose"> & { item: GroceryItemDTO; close: () => void }) {
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
			</div>
		</form>
	)
}
