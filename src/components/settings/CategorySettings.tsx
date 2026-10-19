"use client"

import { reorderCategories, setCategoryHidden } from "@/lib/grocery/actions"
import type { CategoryDTO } from "@/lib/grocery/categories"
import Icon, { handleButtonClass, iconButtonClass } from "@/components/ui/Icon"
import { useSortable } from "@/components/ui/useSortable"
import { useRouter } from "next/navigation"
import { useTransition } from "react"

// Reihenfolge der Kategorien im Laden für eine Liste, per Drag & Drop (oder ↑/↓); categories kommen bereits sortiert.
// Kategorien, die es im Laden nicht gibt, lassen sich ausblenden.
export default function CategorySettings({ listId, categories, hiddenIds }: { listId: string; categories: CategoryDTO[]; hiddenIds: string[] }) {
	const router = useRouter()
	const [pending, startTransition] = useTransition()

	const run = (action: () => Promise<unknown>) =>
		startTransition(async () => {
			await action()
			router.refresh()
		})

	const sortable = useSortable(
		categories.map((category) => category.id),
		(ids) => run(() => reorderCategories(listId, ids)),
	)
	const { dragId } = sortable
	const byId = new Map(categories.map((category) => [category.id, category]))
	const ordered = sortable.order.map((id) => byId.get(id)).filter((category): category is CategoryDTO => !!category)

	return (
		<ol className="space-y-1">
			{ordered.map((category) => (
				<li
					key={category.id}
					ref={sortable.rowRef(category.id)}
					className={`flex items-center gap-2 rounded border bg-(--surface) px-2 py-1 ${dragId === category.id ? "border-emerald-600 shadow-lg" : "border-(--border)"}`}
				>
					{/* Griff: nur hier startet Drag & Drop, damit die Seite sonst normal scrollt */}
					<button
						type="button"
						aria-label={`${category.name} verschieben`}
						title="Ziehen oder Pfeiltasten zum Sortieren"
						className={`${iconButtonClass} ${handleButtonClass}`}
						{...sortable.handleProps(category.id)}
					>
						<Icon name="grip" />
					</button>
					<span className={`min-w-0 flex-1 truncate ${hiddenIds.includes(category.id) ? "line-through opacity-50" : ""}`}>{category.name}</span>
					<button
						type="button"
						className={iconButtonClass}
						aria-pressed={hiddenIds.includes(category.id)}
						aria-label={`${category.name} ${hiddenIds.includes(category.id) ? "einblenden" : "ausblenden"}`}
						title={hiddenIds.includes(category.id) ? "Einblenden" : "Gibt es in diesem Laden nicht – ausblenden"}
						disabled={pending}
						onClick={() => run(() => setCategoryHidden(listId, category.id, !hiddenIds.includes(category.id)))}
					>
						<Icon name={hiddenIds.includes(category.id) ? "eyeOff" : "eye"} />
					</button>
				</li>
			))}
			{ordered.length === 0 && <li className="text-sm opacity-60">Noch keine Kategorien.</li>}
		</ol>
	)
}
