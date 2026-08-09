"use client"
import { onboardUser } from "@/lib/onboarding/actions"

export default function OnboardingPage() {
	return (
		<div>
			<h1>Erstelle deinen ersten Plan</h1>
			<form action={onboardUser}>
				<label htmlFor="planName">Wie soll dein Plan heißen?</label>
				<input type="text" name="planName" id="planName"/>
				<label htmlFor="listName">Wie heißt deine erste Einkaufsliste?</label>
				<input type="text" name="listName" id="listName" defaultValue={"Einkaufsliste"}/>
				<input type="submit" value="Plan erstellen"/>
			</form>
		</div>
	)
}
