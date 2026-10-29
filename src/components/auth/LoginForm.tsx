"use client"

import { loginUser } from "@/lib/login/actions"
import { useActionState } from "react"
import PasswordInput from "@/components/forms/PasswordInput"

export default function LoginForm({ callbackUrl }: { callbackUrl: string }) {
	const [state, formAction, pending] = useActionState(loginUser, undefined)

	return (
		<form action={formAction} className="form">
			<input type="hidden" name="callbackUrl" value={callbackUrl} />
			<label htmlFor="email">E-Mail</label>
			<input type="email" id="email" name="email" required />
			<label htmlFor="password">Passwort</label>
			<PasswordInput id="password" name="password" required />
			{state?.error && <p className="error">{state.error}</p>}
			<button type="submit" disabled={pending}>
				Anmelden
			</button>
		</form>
	)
}
