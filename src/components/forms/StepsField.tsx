"use client"

import Icon, { handleButtonClass, iconButtonClass } from "@/components/ui/Icon"
import { useSortable } from "@/components/ui/useSortable"
import { useState } from "react"

type Step = { id: number; text: string }

// stabile Keys für die Felder, damit Fokus/Cursor beim Verschieben und Löschen erhalten bleiben
let nextStepId = 0
const createStep = (text: string): Step => ({ id: nextStepId++, text })

// Zubereitungsschritte als einzelne Felder; Reihenfolge über den Griff, neue Schritte über "+ Schritt"
export default function StepsField({ initial, onChange }: { initial: string[]; onChange: (steps: string[]) => void }) {
	const [steps, setSteps] = useState<Step[]>(() => (initial.length ? initial : [""]).map(createStep))
	const [focusId, setFocusId] = useState<number | null>(null)

	const update = (next: Step[]) => {
		setSteps(next)
		onChange(next.map((step) => step.text))
	}

	const sortable = useSortable(
		steps.map((step) => String(step.id)),
		(ids) => update(ids.map((id) => steps.find((step) => String(step.id) === id)!).filter(Boolean)),
	)
	const ordered = sortable.order.map((id) => steps.find((step) => String(step.id) === id)).filter((step): step is Step => !!step)

	return (
		<fieldset className="space-y-2">
			<legend className="font-semibold">Zubereitung</legend>
			<ol className="space-y-2">
				{ordered.map((step, index) => (
					<li
						key={step.id}
						ref={sortable.rowRef(String(step.id))}
						className={`flex items-start gap-2 ${sortable.dragId === String(step.id) ? "rounded shadow-lg ring-2 ring-emerald-600" : ""}`}
					>
						<button
							type="button"
							aria-label={`Schritt ${index + 1} verschieben`}
							title="Ziehen oder Pfeiltasten zum Sortieren"
							className={`${iconButtonClass} ${handleButtonClass}`}
							{...sortable.handleProps(String(step.id))}
						>
							<Icon name="grip" />
						</button>
						<span className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-xs text-white">{index + 1}</span>
						<textarea
							aria-label={`Schritt ${index + 1}`}
							rows={2}
							className="input field-sizing-content min-h-16 flex-1"
							value={step.text}
							ref={(element) => {
								if (element && focusId === step.id) {
									element.focus()
									setFocusId(null)
								}
							}}
							onChange={(event) => update(steps.map((current) => (current.id === step.id ? { ...current, text: event.target.value } : current)))}
						/>
						<button
							type="button"
							className="btn-link size-11 shrink-0 justify-center"
							aria-label={`Schritt ${index + 1} entfernen`}
							onClick={() => update(steps.filter((current) => current.id !== step.id))}
						>
							✕
						</button>
					</li>
				))}
			</ol>
			<button
				type="button"
				className="btn-link"
				onClick={() => {
					const step = createStep("")
					setFocusId(step.id)
					update([...steps, step])
				}}
			>
				+ Schritt
			</button>
		</fieldset>
	)
}
