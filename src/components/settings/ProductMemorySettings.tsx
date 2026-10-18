"use client"

import { forgetProduct, setProductCategory } from "@/lib/grocery/actions"
import type { CategoryDTO, ProductMemoryDTO } from "@/lib/grocery/categories"
import { foldForMatch } from "@/lib/grocery/suggest"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

const NONE = "__none"
const ALL = "__all"
const PAGE = 60

type ProductMemorySettingsProps = { planId: string; categories: CategoryDTO[]; products: ProductMemoryDTO[] }

// Gedächtnis des Plans: welche Produkte bekannt sind und in welche Kategorie sie automatisch kommen
export default function ProductMemorySettings({ planId, categories, products }: ProductMemorySettingsProps) {
	const router = useRouter()
	const [query, setQuery] = useState("")
	const [filter, setFilter] = useState(ALL)
	const [limit, setLimit] = useState(PAGE)
	const [newName, setNewName] = useState("")
	const [newCategory, setNewCategory] = useState("")
	const [pending, startTransition] = useTransition()

	const run = (action: () => Promise<unknown>) =>
		startTransition(async () => {
			await action()
			router.refresh()
		})

	const folded = foldForMatch(query)
	const matching = products
		.filter((product) => !folded || foldForMatch(product.displayName).includes(folded))
		.filter((product) => filter === ALL || (filter === NONE ? !product.categoryId : product.categoryId === filter))
		.sort((a, b) => a.displayName.localeCompare(b.displayName, "de"))
	const shown = matching.slice(0, limit)

	return (
		<div className="space-y-2">
			<div className="flex flex-wrap gap-2">
				<input className="input min-w-0 flex-1" placeholder="Produkt suchen" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Produkt suchen" />
				<select className="input w-auto" value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Nach Kategorie filtern">
					<option value={ALL}>Alle Kategorien</option>
					<option value={NONE}>Ohne Kategorie</option>
					{categories.map((category) => (
						<option key={category.id} value={category.id}>
							{category.name}
						</option>
					))}
				</select>
			</div>

			<ul className="divide-y divide-black/5 dark:divide-white/10">
				{shown.map((product) => (
					<li key={product.displayName} className="flex items-center gap-2 py-1">
						<span className="min-w-0 flex-1 truncate">{product.displayName}</span>
						<select
							className="input w-36 py-1 text-sm"
							aria-label={`Kategorie von ${product.displayName}`}
							value={product.categoryId ?? ""}
							disabled={pending}
							onChange={(event) => run(() => setProductCategory(planId, product.displayName, event.target.value || null))}
						>
							<option value="">Keine</option>
							{categories.map((category) => (
								<option key={category.id} value={category.id}>
									{category.name}
								</option>
							))}
						</select>
						<button
							type="button"
							className="btn-link flex size-8 shrink-0 items-center justify-center text-red-600"
							aria-label={`${product.displayName} vergessen`}
							title="Vergessen"
							disabled={pending}
							onClick={() => run(() => forgetProduct(planId, product.displayName))}
						>
							✕
						</button>
					</li>
				))}
				{matching.length === 0 && <li className="py-1 text-sm opacity-60">Keine Produkte gefunden.</li>}
			</ul>
			{matching.length > shown.length && (
				<button type="button" className="btn-link text-sm" onClick={() => setLimit(limit + PAGE)}>
					{matching.length - shown.length} weitere anzeigen
				</button>
			)}

			<form
				className="flex flex-wrap gap-2"
				onSubmit={(event) => {
					event.preventDefault()
					run(async () => {
						await setProductCategory(planId, newName, newCategory || null)
						setNewName("")
					})
				}}
			>
				<input className="input min-w-0 basis-full sm:basis-0 sm:flex-1" placeholder="Neues Produkt" value={newName} onChange={(event) => setNewName(event.target.value)} required />
				<select className="input min-w-0 flex-1 sm:w-36 sm:flex-none" value={newCategory} onChange={(event) => setNewCategory(event.target.value)} aria-label="Kategorie für neues Produkt">
					<option value="">Keine</option>
					{categories.map((category) => (
						<option key={category.id} value={category.id}>
							{category.name}
						</option>
					))}
				</select>
				<button type="submit" className="btn-secondary" disabled={pending}>
					Hinzufügen
				</button>
			</form>
		</div>
	)
}
