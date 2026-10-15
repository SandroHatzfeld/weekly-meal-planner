"use server"

import { AuthError } from "next-auth"
import { signIn } from "@/lib/auth/auth"

export type FormState = { error?: string } | undefined

// nur relative Pfade erlauben, keine Open-Redirects
const safeRedirect = (value: FormDataEntryValue | null) =>
	typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/"

export const loginUser = async (_prevState: FormState, formData: FormData): Promise<FormState> => {
	const formEmail = formData.get("email")
	const formPassword = formData.get("password")

	if (typeof formEmail !== "string" || typeof formPassword !== "string") return { error: "Ungültige Eingabe" }

	try {
		await signIn("credentials", {
			email: formEmail,
			password: formPassword,
			redirectTo: safeRedirect(formData.get("callbackUrl")),
		})
	} catch (error) {
		if (error instanceof AuthError) {
			if ("code" in error && error.code === "email_not_verified") {
				return { error: "Bitte bestätige zuerst deine E-Mail-Adresse" }
			}
			return { error: "E-Mail oder Passwort falsch" }
		}
		throw error
	}
}
