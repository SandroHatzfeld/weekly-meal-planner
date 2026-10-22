"use client"

import Icon from "@/components/ui/Icon"

// Anzeige (ohne onChange) oder Eingabe der internen Bewertung; erneut auf den gewählten Stern tippen = zurücksetzen
export default function StarRating({ value, onChange, className = "size-5" }: { value: number | null; onChange?: (value: number | null) => void; className?: string }) {
	const stars = [1, 2, 3, 4, 5]
	if (!onChange) {
		return (
			<span className="inline-flex" role="img" aria-label={value ? `${value} von 5 Sternen` : "nicht bewertet"}>
				{stars.map((star) => (
					<span key={star} className={star <= (value ?? 0) ? "text-amber-500" : "opacity-30"}>
						<Icon name="star" className={className} filled={star <= (value ?? 0)} />
					</span>
				))}
			</span>
		)
	}
	return (
		<span className="inline-flex" role="group" aria-label="Bewertung">
			{stars.map((star) => (
				<button
					key={star}
					type="button"
					aria-label={`${star} ${star === 1 ? "Stern" : "Sterne"}`}
					aria-pressed={star === value}
					className={`flex size-9 items-center justify-center ${star <= (value ?? 0) ? "text-amber-500" : "opacity-40"}`}
					onClick={() => onChange(star === value ? null : star)}
				>
					<Icon name="star" className="size-6" filled={star <= (value ?? 0)} />
				</button>
			))}
		</span>
	)
}
