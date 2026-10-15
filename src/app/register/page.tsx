import RegisterForm from "@/components/auth/RegisterForm"
import Link from "next/link"

export default function RegisterPage() {
	return (
		<main className="auth-page">
			<h1>Registrieren</h1>
			<RegisterForm />
			<p>
				Schon registriert? <Link href="/login">Einloggen</Link>
			</p>
		</main>
	)
}
