"use client"

import { forgetProduct, setProductCategories } from "@/lib/grocery/actions"
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

	const update = (product: ProductMemoryDTO, categoryIds: string[]) => run(() => setProductCategories(planId, product.displayName, categoryIds))

	const folded = foldForMatch(query)
	const matching = products
		.filter((product) => !folded || foldForMatch(product.displayName).includes(folded))
		.filter((product) => filter === ALL || (filter === NONE ? product.categoryIds.length === 0 : product.categoryIds.includes(filter)))
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
					<li key={product.displayName} className="space-y-1 py-2">
						<div className="flex items-center gap-2">
							<span className="min-w-0 flex-1 truncate">{product.displayName}</span>
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
						</div>
						{/* Kategorien in Reihenfolge: die erste ist die Hauptkategorie, die weiteren springen ein,
						    wenn eine Kategorie in einer Liste ausgeblendet ist */}
						<div className="flex flex-wrap items-center gap-1" aria-label={`Kategorien von ${product.displayName}`}>
							{product.categoryIds.map((id, index) => {
								const category = categories.find((candidate) => candidate.id === id)
								if (!category) return null
								return (
									<span
										key={id}
										className={`inline-flex items-center rounded-full border text-sm ${index === 0 ? "border-emerald-600 bg-emerald-700 text-white" : "border-(--border)"}`}
									>
										<button
											type="button"
											className="py-1 pl-3 pr-1 disabled:cursor-default"
											aria-label={index === 0 ? `${category.name} (Hauptkategorie)` : `${category.name} als Hauptkategorie`}
											title={index === 0 ? "Hauptkategorie" : "Als Hauptkategorie verwenden"}
											disabled={pending || index === 0}
											onClick={() => update(product, [id, ...product.categoryIds.filter((other) => other !== id)])}
										>
											{category.name}
										</button>
										<button
											type="button"
											className="flex size-7 items-center justify-center opacity-70 hover:opacity-100"
											aria-label={`${category.name} von ${product.displayName} entfernen`}
											disabled={pending}
											onClick={() => update(product, product.categoryIds.filter((other) => other !== id))}
										>
											✕
										</button>
									</span>
								)
							})}
							{categories.some((category) => !product.categoryIds.includes(category.id)) && (
								<select
									className="input w-auto py-1 text-sm"
									aria-label={`Kategorie zu ${product.displayName} hinzufügen`}
									value=""
									disabled={pending}
									onChange={(event) => event.target.value && update(product, [...product.categoryIds, event.target.value])}
								>
									<option value="">{product.categoryIds.length ? "+ Ausweichkategorie" : "+ Kategorie"}</option>
									{categories
										.filter((category) => !product.categoryIds.includes(category.id))
										.map((category) => (
											<option key={category.id} value={category.id}>
												{category.name}
											</option>
										))}
								</select>
							)}
						</div>
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
						await setProductCategories(planId, newName, newCategory ? [newCategory] : [])
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
