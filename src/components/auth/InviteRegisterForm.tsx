"use client"

import { registerViaInvite } from "@/lib/invite/actions"
import { useActionState } from "react"
import PasswordInput from "@/components/forms/PasswordInput"

export default function InviteRegisterForm({ token, email }: { token: string; email: string | null }) {
	const [state, formAction, pending] = useActionState(registerViaInvite.bind(null, token), undefined)

	return (
		<form action={formAction} className="form">
			<label htmlFor="name">Benutzername</label>
			<input type="text" id="name" name="name" required />
			<label htmlFor="email">E-Mail</label>
			{email ? (
				<input type="email" id="email" value={email} readOnly />
			) : (
				<input type="email" id="email" name="email" required />
			)}
			<label htmlFor="password">Passwort</label>
			<PasswordInput id="password" name="password" minLength={8} required />
			{state?.error && <p className="error">{state.error}</p>}
			<button type="submit" disabled={pending}>
				Account anlegen & beitreten
			</button>
		</form>
	)
}
