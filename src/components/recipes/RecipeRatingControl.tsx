"use client"

import StarRating from "@/components/recipes/StarRating"
import { setRecipeRating } from "@/lib/recipes/actions"
import { useState } from "react"

// Bewertung auf der Rezeptseite: Klick speichert sofort, bei einem Fehler springt der Wert zurück
export default function RecipeRatingControl({ recipeId, initial }: { recipeId: string; initial: number | null }) {
	const [rating, setRating] = useState(initial)
	return (
		<StarRating
			value={rating}
			onChange={async (next) => {
				const previous = rating
				setRating(next)
				const result = await setRecipeRating(recipeId, next).catch(() => ({ error: "Fehler" }))
				if ("error" in result) setRating(previous)
			}}
		/>
	)
}
