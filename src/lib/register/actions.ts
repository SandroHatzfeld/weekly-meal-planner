"use server"

import { hashPassword } from "@/lib/password"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"

export const registerUser = async (formData: FormData) => {
	const formName = formData.get("name")
	const formEmail = formData.get("email")
	const formPassword = formData.get("password")
	// check if type of formdata is string
	if (typeof formName !== "string" || typeof formEmail !== "string" || typeof formPassword !== "string") return null

	const passwordHash = await hashPassword(formPassword)

	try {
		await prisma.user.create({ data: { name: formName, email: formEmail, passwordHash: passwordHash } })
	} catch (error) {
		if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
			// noch ausbauen sobald formular im Frontend existiert
			console.error("Email schon vergeben")
			return
		}
		throw error
	}

	// hier noch die email bestätigung einfügen
	redirect("/login")
}
