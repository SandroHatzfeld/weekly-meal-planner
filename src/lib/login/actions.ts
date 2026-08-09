"use server"

import { AuthError } from "next-auth"
import { signIn } from "../auth"

export const loginUser = async (formData: FormData) => {
	const formEmail = formData.get("email")
	const formPassword = formData.get("password")

	if(typeof formEmail !== "string" || typeof formPassword !== "string") return

	try {
		await signIn("credentials", {email: formEmail, password: formPassword, redirectTo: "/"})
	} catch (error) {
		if(error instanceof AuthError) {
			console.log(error)
			return
		}
		throw error
		
	}
}