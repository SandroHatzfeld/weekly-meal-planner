"use client"

import TagIcon from "@/components/tags/TagIcon"
import type { CategoryDTO } from "@/lib/grocery/categories"
import type { TagDTO } from "@/lib/tags/icons"
import Dropdown from "@/components/ui/Dropdown"
import Modal from "@/components/ui/Modal"
import { useEffect, useRef, useState } from "react"

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
	// Das Popup speichert sofort: beim Schließen (Escape, Hintergrund, ✕) noch offene Texteingaben übernehmen
	const flush = useRef<() => void>(undefined)
	return (
		<Modal
			open={!!item}
			onClose={() => {
				flush.current?.()
				onClose()
			}}
			labelledBy="item-edit-title"
			focusDialog
		>
			{/* key: Formular bei jedem geöffneten Eintrag frisch initialisieren */}
			{item && <EditForm key={item.id} item={item} lists={lists} tags={tags} categories={categories} hiddenCategories={hiddenCategories} onSave={onSave} onDelete={onDelete} close={onClose} registerFlush={(fn) => { flush.current = fn }} />}
		</Modal>
	)
}

// Änderungen werden direkt gespeichert, es gibt kein Speichern/Abbrechen:
// Name und Details beim Verlassen des Felds (oder Enter), Liste, Kategorie und Tags sofort.
function EditForm<T extends EditableItem>({
	item,
	lists,
	tags,
	categories = [],
	hiddenCategories = {},
	onSave,
	onDelete,
	close,
	registerFlush,
}: Omit<ItemEditDialogProps<T>, "item" | "onClose"> & { item: T; close: () => void; registerFlush: (flush: (() => void) | undefined) => void }) {
	const [name, setName] = useState(item.name)
	const [details, setDetails] = useState(item.details ?? "")
	const [listId, setListId] = useState(item.listId)
	const [tagIds, setTagIds] = useState(item.tagIds)
	const initialCategory = item.categoryId === undefined ? AUTO : (item.categoryId ?? "")
	const [categoryId, setCategoryId] = useState<string>(initialCategory)
	// gewählte Kategorie bleibt sichtbar, auch wenn sie in dieser Liste ausgeblendet ist
	const offered = categories.filter((category) => category.id === categoryId || !hiddenCategories[listId]?.includes(category.id))

	// zuletzt gespeicherter Stand: Grundlage für "was hat sich geändert" (jede Speicherung bekommt nur ihre eigene Änderung)
	const saved = useRef<T>(item)
	// Speicherungen nacheinander ausführen, damit schnelle Änderungen sich nicht überholen
	const queue = useRef<Promise<void>>(Promise.resolve())
	const typed = useRef({ name: item.name, details: item.details ?? "" })
	const deleted = useRef(false)

	const persist = (patch: Partial<ItemChanges>) => {
		if (deleted.current) return
		const before = saved.current
		const changes: ItemChanges = {
			name: patch.name ?? before.name,
			details: patch.details ?? before.details ?? "",
			listId: patch.listId ?? before.listId,
			tagIds: patch.tagIds ?? before.tagIds,
			categoryId: "categoryId" in patch ? patch.categoryId : undefined,
		}
		saved.current = {
			...before,
			name: changes.name.trim() || before.name,
			details: changes.details.trim() || null,
			listId: changes.listId,
			tagIds: changes.tagIds,
			categoryId: "categoryId" in patch ? changes.categoryId : before.categoryId,
		}
		queue.current = queue.current.then(() => onSave(before, changes)).catch(() => {})
	}

	// Name/Details speichern, wenn sie sich geändert haben; ein leerer Name wird zurückgesetzt
	const commitText = () => {
		if (deleted.current) return
		const { name: typedName, details: typedDetails } = typed.current
		if (!typedName.trim()) {
			typed.current.name = saved.current.name
			setName(saved.current.name)
		}
		const nextName = typedName.trim() || saved.current.name
		const changedName = nextName !== saved.current.name
		const changedDetails = (typedDetails.trim() || null) !== saved.current.details
		if (changedName || changedDetails) persist({ name: nextName, details: typedDetails })
	}
	useEffect(() => {
		registerFlush(commitText)
		return () => registerFlush(undefined)
	})

	return (
		<form
			className="form max-w-none gap-3 p-4"
			onSubmit={(event) => {
				// React-Events laufen auch durch Portale nach oben – das äußere Formular (Planen) nicht mit absenden
				event.preventDefault()
				event.stopPropagation()
			}}
			onKeyDown={(event) => {
				if (event.key !== "Enter" || !(event.target instanceof HTMLInputElement)) return
				// Enter: Eingabe übernehmen und Feld verlassen (auf dem Handy verschwindet die Tastatur)
				event.preventDefault()
				event.stopPropagation()
				commitText()
				event.target.blur()
			}}
		>
			<div className="flex items-start justify-between gap-2">
				<h2 id="item-edit-title" className="text-lg font-semibold">Eintrag bearbeiten</h2>
				<button type="button" className="btn-link -mt-2 -mr-3 flex size-11 shrink-0 items-center justify-center" aria-label="Schließen" onClick={close}>
					✕
				</button>
			</div>
			<label htmlFor="item-name">Name</label>
			<input
				id="item-name"
				value={name}
				required
				onChange={(event) => {
					setName(event.target.value)
					typed.current.name = event.target.value
				}}
				onBlur={commitText}
			/>
			<label htmlFor="item-details">Details</label>
			<input
				id="item-details"
				value={details}
				placeholder="z.B. 500 g"
				onChange={(event) => {
					setDetails(event.target.value)
					typed.current.details = event.target.value
				}}
				onBlur={commitText}
			/>
			{lists.length > 1 && (
				<>
					<span className="text-sm font-medium">Liste</span>
					<Dropdown
						label="Liste"
						value={listId}
						options={lists.map((list) => ({ value: list.id, label: list.name }))}
						onChange={(value) => {
							setListId(value)
							persist({ listId: value })
						}}
						align="left"
					/>
				</>
			)}
			{(offered.length > 0 || categoryId === AUTO) && (
				<>
					<span className="text-sm font-medium">Kategorie</span>
					<Dropdown
						label="Kategorie"
						value={categoryId}
						options={[
							...(categoryId === AUTO ? [{ value: AUTO, label: "Automatisch (zuletzt verwendete)" }] : []),
							{ value: "", label: "Keine (Sonstiges)" },
							...offered.map((category) => ({
								value: category.id,
								label: hiddenCategories[listId]?.includes(category.id) ? `${category.name} (hier ausgeblendet)` : category.name,
							})),
						]}
						onChange={(value) => {
							setCategoryId(value)
							if (value !== AUTO) persist({ categoryId: value || null })
						}}
						align="left"
					/>
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
									onClick={() => {
										const next = active ? tagIds.filter((id) => id !== tag.id) : [...tagIds, tag.id]
										setTagIds(next)
										persist({ tagIds: next })
									}}
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
			{onDelete && (
				<div className="mt-2 flex items-center">
					<button
						type="button"
						className="btn-danger ml-auto"
						onClick={async () => {
							deleted.current = true
							await onDelete(item)
							close()
						}}
					>
						Löschen
					</button>
				</div>
			)}
		</form>
	)
}
