"use client"

import { useFeedback } from "@/components/ui/Feedback"
import Icon, { iconButtonClass } from "@/components/ui/Icon"
import { createTag, deleteTag, updateTag } from "@/lib/tags/actions"
import { TAG_ICONS, type TagDTO, type TagIconKey } from "@/lib/tags/icons"
import { useState, useTransition } from "react"
import TagIcon from "./TagIcon"

function IconPicker({ value, onChange }: { value: TagIconKey; onChange: (icon: TagIconKey) => void }) {
	return (
		<div role="radiogroup" aria-label="Icon" className="flex flex-wrap gap-1">
			{(Object.keys(TAG_ICONS) as TagIconKey[]).map((icon) => (
				<button
					key={icon}
					type="button"
					role="radio"
					aria-checked={icon === value}
					aria-label={TAG_ICONS[icon].label}
					title={TAG_ICONS[icon].label}
					onClick={() => onChange(icon)}
					className={`flex size-9 items-center justify-center rounded border ${icon === value ? "border-emerald-600 bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-50" : "border-(--border) opacity-70 hover:opacity-100"}`}
				>
					<TagIcon icon={icon} className="size-5" />
				</button>
			))}
		</div>
	)
}

function TagRow({ tag }: { tag: TagDTO }) {
	const { confirm } = useFeedback()
	const [name, setName] = useState(tag.name)
	const [icon, setIcon] = useState(tag.icon)
	const [picking, setPicking] = useState(false)
	const [pending, startTransition] = useTransition()
	const dirty = name !== tag.name || icon !== tag.icon

	return (
		<li className="space-y-2 py-2">
			<div className="flex items-center gap-2">
				<button
					type="button"
					className="flex size-9 shrink-0 items-center justify-center rounded border border-(--border)"
					aria-label={`Icon von ${tag.name} ändern`}
					aria-expanded={picking}
					onClick={() => setPicking(!picking)}
				>
					<TagIcon icon={icon} className="size-5" />
				</button>
				<input className="input flex-1" value={name} aria-label="Name des Tags" onChange={(event) => setName(event.target.value)} />
				{dirty && (
					<button
						type="button"
						className="btn"
						disabled={pending || !name.trim()}
						onClick={() =>
							startTransition(async () => {
								await updateTag(tag.id, name, icon)
								setPicking(false)
							})
						}
					>
						Speichern
					</button>
				)}
				<button
					type="button"
					className={`${iconButtonClass} text-red-600`}
					title="Löschen"
					aria-label={`${tag.name} löschen`}
					disabled={pending}
					onClick={async () => {
						if (await confirm({ title: `Tag „${tag.name}“ löschen?`, message: "Er wird auch von allen Einträgen entfernt.", confirmLabel: "Löschen", danger: true }))
							startTransition(() => deleteTag(tag.id))
					}}
				>
					<Icon name="trash" />
				</button>
			</div>
			{picking && <IconPicker value={icon} onChange={setIcon} />}
		</li>
	)
}

export default function TagSettings({ planId, tags }: { planId: string; tags: TagDTO[] }) {
	const [name, setName] = useState("")
	const [icon, setIcon] = useState<TagIconKey>("tag")
	const [pending, startTransition] = useTransition()

	return (
		<div className="space-y-3">
			<ul className="divide-y divide-black/5 dark:divide-white/10">
				{tags.map((tag) => (
					// key mit Name/Icon: nach Änderungen anderer Mitglieder neu initialisieren
					<TagRow key={`${tag.id}:${tag.name}:${tag.icon}`} tag={tag} />
				))}
				{tags.length === 0 && <li className="py-2 text-sm opacity-60">Noch keine Tags.</li>}
			</ul>
			<form
				className="space-y-2"
				onSubmit={(event) => {
					event.preventDefault()
					startTransition(async () => {
						const result = await createTag(planId, name, icon)
						if (result.tag) {
							setName("")
							setIcon("tag")
						}
					})
				}}
			>
				<div className="flex gap-2">
					<span className="flex size-9 shrink-0 items-center justify-center rounded border border-(--border)" aria-hidden="true">
						<TagIcon icon={icon} className="size-5" />
					</span>
					<input className="input flex-1" placeholder="Neuer Tag, z.B. Tiefkühl" value={name} onChange={(event) => setName(event.target.value)} required />
					<button type="submit" className="btn" disabled={pending}>
						Hinzufügen
					</button>
				</div>
				<IconPicker value={icon} onChange={setIcon} />
			</form>
		</div>
	)
}
