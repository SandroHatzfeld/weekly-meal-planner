import { loginUser } from "@/lib/login/actions"
import React from "react"

export default function loginPage() {

	return (
		<div>
			<h1>Einloggen</h1>
			<form action={loginUser}>
				<label htmlFor="email">E-Mail</label>
				<input type="text" id="email" name="email"/>
				<label htmlFor="password">Passwort</label>
				<input type="password" id="password" name="password"/>
				<input type="submit" value="Anmelden" />
			</form>
		</div>
	)
}
