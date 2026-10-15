"use client"

import { registerUser } from "@/lib/register/actions"
import { useActionState } from "react"

export default function RegisterForm() {
	const [state, formAction, pending] = useActionState(registerUser, undefined)

	return (
		<form action={formAction} className="form">
			<label htmlFor="name">Benutzername</label>
			<input type="text" id="name" name="name" required />
			<label htmlFor="email">E-Mail</label>
			<input type="email" id="email" name="email" required />
			<label htmlFor="password">Passwort</label>
			<input type="password" id="password" name="password" minLength={8} required />
			{state?.error && <p className="error">{state.error}</p>}
			<button type="submit" disabled={pending}>
				Registrieren
			</button>
		</form>
	)
}
