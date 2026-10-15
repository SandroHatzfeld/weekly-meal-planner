"use server"

import { hashPassword } from "@/lib/password"
import { prisma } from "@/lib/prisma"
import { sendVerificationMail } from "@/lib/verification"
import { redirect } from "next/navigation"

export type FormState = { error?: string } | undefined

export const registerUser = async (_prevState: FormState, formData: FormData): Promise<FormState> => {
	const formName = formData.get("name")
	const formEmail = formData.get("email")
	const formPassword = formData.get("password")
	// check if type of formdata is string
	if (typeof formName !== "string" || typeof formEmail !== "string" || typeof formPassword !== "string") {
		return { error: "Ungültige Eingabe" }
	}
	const name = formName.trim()
	const email = formEmail.trim().toLowerCase()
	if (!name || !email.includes("@")) return { error: "Bitte Name und gültige E-Mail angeben" }
	if (formPassword.length < 8) return { error: "Das Passwort muss mindestens 8 Zeichen lang sein" }

	const passwordHash = await hashPassword(formPassword)

	let user
	try {
		user = await prisma.user.create({ data: { name, email, passwordHash } })
	} catch (error) {
		if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
			return { error: "Diese E-Mail ist bereits registriert" }
		}
		throw error
	}

	await sendVerificationMail(user)
	redirect("/register/check-mail")
}
