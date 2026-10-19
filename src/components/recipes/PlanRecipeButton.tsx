"use client"

import PlanDishDialog, { type PlanOption } from "@/components/dishes/PlanDishDialog"
import Icon, { iconButtonClass } from "@/components/ui/Icon"
import type { RecipeSuggestion } from "@/lib/recipes/actions"
import { useRouter } from "next/navigation"
import { useState } from "react"

type PlanRecipeButtonProps = {
	recipe: RecipeSuggestion
	plans: PlanOption[]
	initialPlanId: string
	initialDate: string
	today: string
}

// Icon-Button neben dem Rezeptnamen: öffnet dasselbe Planen-Popup wie Woche/Monat, Rezept ist vorausgewählt
export default function PlanRecipeButton({ recipe, plans, initialPlanId, initialDate, today }: PlanRecipeButtonProps) {
	const router = useRouter()
	const [open, setOpen] = useState(false)

	return (
		<>
			<button type="button" className={iconButtonClass} aria-label="Planen" title="Planen" onClick={() => setOpen(true)}>
				<Icon name="calendarPlus" />
			</button>
			<PlanDishDialog
				open={open}
				onClose={() => setOpen(false)}
				plans={plans}
				initialPlanId={initialPlanId}
				initialDate={initialDate}
				today={today}
				initialRecipe={recipe}
				// geplant -> Rezept schließen, zurück zur Übersicht
				onPlanned={() => router.push("/recipes")}
			/>
		</>
	)
}
