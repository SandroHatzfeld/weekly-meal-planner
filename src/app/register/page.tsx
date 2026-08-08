import { registerUser } from "@/lib/register/actions"

export default function registerPage() {
	return (
		<div>
			<h1>Registieren</h1>
			<form action={registerUser}>
				<label htmlFor="name">Benutername</label>
				<input type="text" id="name" name="name" />
				<label htmlFor="email">E-Mail</label>
				<input type="email" id="email" name="email" />
				<label htmlFor="password">Passwort</label>
				<input type="password" id="password" name="password" />
			</form>
		</div>
	)
}
