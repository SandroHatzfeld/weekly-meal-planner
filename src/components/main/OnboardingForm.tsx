"use client"

import { createPlan } from "@/lib/plan/actions"
import { useActionState } from "react"

export default function OnboardingForm() {
	const [state, formAction, pending] = useActionState(createPlan, undefined)

	return (
		<form action={formAction} className="form">
			<label htmlFor="planName">Wie soll dein Plan heißen?</label>
			<input type="text" name="planName" id="planName" required />
			<label htmlFor="listName">Wie heißt deine erste Einkaufsliste?</label>
			<input type="text" name="listName" id="listName" defaultValue={"Einkaufsliste"} />
			<label htmlFor="inviteEmails">Personen einladen (optional, E-Mails kommagetrennt)</label>
			<input type="text" name="inviteEmails" id="inviteEmails" placeholder="anna@example.com, ben@example.com" />
			{state?.error && <p className="error">{state.error}</p>}
			<button type="submit" disabled={pending}>
				Plan erstellen
			</button>
		</form>
	)
}
