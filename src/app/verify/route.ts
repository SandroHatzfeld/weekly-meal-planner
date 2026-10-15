import { signIn } from "@/lib/auth/auth"
import { AuthError } from "next-auth"
import { NextResponse, type NextRequest } from "next/server"

// Klick auf den Verifizierungslink: E-Mail bestätigen + Auto-Login
export async function GET(request: NextRequest) {
	const token = request.nextUrl.searchParams.get("token")
	if (!token) return NextResponse.redirect(new URL("/login", request.url))

	try {
		// "/" leitet ohne Plan automatisch ins Onboarding weiter
		await signIn("email-token", { token, redirectTo: "/" })
	} catch (error) {
		if (error instanceof AuthError) {
			return new NextResponse("Der Bestätigungslink ist ungültig oder abgelaufen.", {
				status: 400,
				headers: { "Content-Type": "text/plain; charset=utf-8" },
			})
		}
		throw error
	}
}
