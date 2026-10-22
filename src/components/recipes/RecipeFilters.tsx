"use client"

import Icon, { iconButtonClass } from "@/components/ui/Icon"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

export type RecipeFilterValues = { q: string; maxMin: string; minRating: string; sort: string; mine: boolean }

// Suche mit ausklappbaren Filtern; jede Änderung wird sofort in die URL übernommen (Suchtext kurz verzögert)
export default function RecipeFilters({ initial }: { initial: RecipeFilterValues }) {
	const router = useRouter()
	const pathname = usePathname()
	const [values, setValues] = useState(initial)
	const [open, setOpen] = useState(false)
	const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
	useEffect(() => () => clearTimeout(timer.current), [])

	const apply = (next: RecipeFilterValues) => {
		const params = new URLSearchParams()
		if (next.q.trim()) params.set("q", next.q.trim())
		if (next.maxMin) params.set("maxMin", next.maxMin)
		if (next.minRating) params.set("minRating", next.minRating)
		if (next.sort !== "name") params.set("sort", next.sort)
		if (next.mine) params.set("mine", "1")
		const query = params.toString()
		router.replace(query ? `${pathname}?${query}` : pathname)
	}
	const change = (patch: Partial<RecipeFilterValues>, delay = 0) => {
		const next = { ...values, ...patch }
		setValues(next)
		clearTimeout(timer.current)
		if (delay) timer.current = setTimeout(() => apply(next), delay)
		else apply(next)
	}
	// aktive Filter (ohne Suchtext) für das Zähl-Badge am Button
	const active = [values.maxMin, values.minRating, values.sort !== "name", values.mine].filter(Boolean).length

	return (
		<div className="space-y-2">
			<div className="flex gap-2">
				<input
					type="search"
					value={values.q}
					onChange={(event) => change({ q: event.target.value }, 300)}
					placeholder="Rezepte suchen…"
					aria-label="Rezepte suchen"
					className="input min-w-0 flex-1"
				/>
				<button
					type="button"
					className={`${iconButtonClass} relative ${open || active ? "border-emerald-600 text-emerald-600" : ""}`}
					aria-label="Filter"
					aria-expanded={open}
					aria-controls="recipe-filters"
					onClick={() => setOpen(!open)}
				>
					<Icon name="filter" />
					{active > 0 && (
						<span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-emerald-600 text-[10px] leading-none text-white">{active}</span>
					)}
				</button>
			</div>
			<div id="recipe-filters" hidden={!open} className="flex flex-wrap items-center gap-2">
				<select value={values.maxMin} onChange={(event) => change({ maxMin: event.target.value })} className="input w-auto" aria-label="Höchstdauer">
					<option value="">Jede Dauer</option>
					<option value="15">bis 15 Min.</option>
					<option value="30">bis 30 Min.</option>
					<option value="60">bis 60 Min.</option>
				</select>
				<select value={values.minRating} onChange={(event) => change({ minRating: event.target.value })} className="input w-auto" aria-label="Mindestbewertung">
					<option value="">Jede Bewertung</option>
					<option value="3">ab 3 Sterne</option>
					<option value="4">ab 4 Sterne</option>
					<option value="5">5 Sterne</option>
				</select>
				<select value={values.sort} onChange={(event) => change({ sort: event.target.value })} className="input w-auto" aria-label="Sortierung">
					<option value="name">Nach Name</option>
					<option value="minutes">Kürzeste zuerst</option>
					<option value="rating">Beste zuerst</option>
				</select>
				<label className="flex items-center gap-1 text-sm whitespace-nowrap">
					<input type="checkbox" checked={values.mine} onChange={(event) => change({ mine: event.target.checked })} /> nur meine
				</label>
			</div>
		</div>
	)
}
