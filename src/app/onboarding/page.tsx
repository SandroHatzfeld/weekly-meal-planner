import OnboardingForm from "@/components/main/OnboardingForm"
import { requireUser } from "@/lib/session"
import Link from "next/link"

export default async function OnboardingPage() {
	const user = await requireUser()
	const isFirstPlan = !user.activePlanId

	return (
		<main className="auth-page">
			<h1>{isFirstPlan ? "Erstelle deinen ersten Plan" : "Neuen Plan erstellen"}</h1>
			<OnboardingForm />
			{!isFirstPlan && <Link href="/">Zurück</Link>}
		</main>
	)
}
