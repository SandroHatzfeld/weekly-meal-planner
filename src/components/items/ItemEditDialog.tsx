"use client"

import TagIcon from "@/components/tags/TagIcon"
import type { CategoryDTO } from "@/lib/grocery/categories"
import type { TagDTO } from "@/lib/tags/icons"
import Modal from "@/components/ui/Modal"
import { useState } from "react"

// categoryId undefined = noch nicht festgelegt (Planen: gemerkte Kategorie wird verwendet)
export type EditableItem = { id: string; name: string; details: string | null; listId: string; tagIds: string[]; categoryId?: string | null }
// categoryId undefined = automatisch (gemerkte Kategorie des Produkts)
export type ItemChanges = { name: string; details: string; listId: string; tagIds: string[]; categoryId?: string | null }

const AUTO = "__auto"

type ItemEditDialogProps<T extends EditableItem> = {
	item: T | null
	lists: { id: string; name: string }[]
	tags: TagDTO[]
	categories?: CategoryDTO[]
	// pro Liste ausgeblendete Kategorien: werden in dieser Liste nicht angeboten
	hiddenCategories?: Record<string, string[]>
	onSave: (item: T, changes: ItemChanges) => void | Promise<void>
	onDelete?: (item: T) => Promise<void> // ohne: kein Löschen-Button
	onClose: () => void
}

export default function ItemEditDialog<T extends EditableItem>({ item, lists, tags, categories = [], hiddenCategories, onSave, onDelete, onClose }: ItemEditDialogProps<T>) {
	return (
		<Modal open={!!item} onClose={onClose} labelledBy="item-edit-title">
			{/* key: Formular bei jedem geöffneten Eintrag frisch initialisieren */}
			{item && <EditForm key={item.id} item={item} lists={lists} tags={tags} categories={categories} hiddenCategories={hiddenCategories} onSave={onSave} onDelete={onDelete} close={onClose} />}
		</Modal>
	)
}

function EditForm<T extends EditableItem>({
	item,
	lists,
	tags,
	categories = [],
	hiddenCategories = {},
	onSave,
	onDelete,
	close,
}: Omit<ItemEditDialogProps<T>, "item" | "onClose"> & { item: T; close: () => void }) {
	const [name, setName] = useState(item.name)
	const [details, setDetails] = useState(item.details ?? "")
	const [listId, setListId] = useState(item.listId)
	const [tagIds, setTagIds] = useState(item.tagIds)
	const initialCategory = item.categoryId === undefined ? AUTO : (item.categoryId ?? "")
	const [categoryId, setCategoryId] = useState<string>(initialCategory)
	const [saving, setSaving] = useState(false)
	// gewählte Kategorie bleibt sichtbar, auch wenn sie in dieser Liste ausgeblendet ist
	const offered = categories.filter((category) => category.id === categoryId || !hiddenCategories[listId]?.includes(category.id))

	return (
		<form
			className="form max-w-none gap-3 p-4"
			onSubmit={async (event) => {
				event.preventDefault()
				// React-Events laufen auch durch Portale nach oben – das äußere Formular (Planen) nicht mit absenden
				event.stopPropagation()
				setSaving(true)
				await onSave(item, { name, details, listId, tagIds, categoryId: categoryId === AUTO ? undefined : categoryId || null })
				setSaving(false)
				close()
			}}
		>
			<h2 id="item-edit-title" className="text-lg font-semibold">Eintrag bearbeiten</h2>
			<label htmlFor="item-name">Name</label>
			<input id="item-name" value={name} onChange={(event) => setName(event.target.value)} required autoFocus />
			<label htmlFor="item-details">Menge / Info</label>
			<input id="item-details" value={details} placeholder="z.B. 500 g" onChange={(event) => setDetails(event.target.value)} />
			{lists.length > 1 && (
				<>
					<label htmlFor="item-list">Liste</label>
					<select
						id="item-list"
						className="input"
						value={listId}
						onChange={(event) => setListId(event.target.value)}
					>
						{lists.map((list) => (
							<option key={list.id} value={list.id}>
								{list.name}
							</option>
						))}
					</select>
				</>
			)}
			{(offered.length > 0 || categoryId === AUTO) && (
				<>
					<label htmlFor="item-category">Kategorie</label>
					<select id="item-category" className="input" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
						{categoryId === AUTO && <option value={AUTO}>Automatisch (zuletzt verwendete)</option>}
						<option value="">Keine (Sonstiges)</option>
						{offered.map((category) => (
							<option key={category.id} value={category.id}>
								{category.name}
								{hiddenCategories[listId]?.includes(category.id) && " (hier ausgeblendet)"}
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
