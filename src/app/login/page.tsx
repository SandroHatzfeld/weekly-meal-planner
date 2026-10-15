import LoginForm from "@/components/auth/LoginForm"
import Link from "next/link"

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
	const { callbackUrl } = await searchParams

	return (
		<main className="auth-page">
			<h1>Einloggen</h1>
			<LoginForm callbackUrl={typeof callbackUrl === "string" ? callbackUrl : "/"} />
			<p>
				Noch kein Account? <Link href="/register">Registrieren</Link>
			</p>
		</main>
	)
}
