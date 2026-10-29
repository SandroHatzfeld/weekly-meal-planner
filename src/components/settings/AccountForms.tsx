"use client"

import { useFeedback } from "@/components/ui/Feedback"
import { cancelEmailChange, changePassword, requestEmailChange, updateName } from "@/lib/user/account"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

// Name und E-Mail; eine neue Adresse gilt erst nach Klick auf den Bestätigungslink
export function ProfileForm({ name, email, pendingEmail }: { name: string; email: string; pendingEmail: string | null }) {
	const router = useRouter()
	const { attempt, notify } = useFeedback()
	const [nameValue, setNameValue] = useState(name)
	const [emailValue, setEmailValue] = useState(email)
	const [password, setPassword] = useState("")
	const [error, setError] = useState<string | null>(null)
	const [pending, startTransition] = useTransition()
	const nameChanged = nameValue.trim() !== name
	const emailChanged = emailValue.trim().toLowerCase() !== email

	return (
		<form
			className="form max-w-none gap-3"
			onSubmit={(event) => {
				event.preventDefault()
				setError(null)
				startTransition(async () => {
					if (nameChanged) {
						const result = await attempt(() => updateName(nameValue))
						if (!result) return
						if (!result.ok) return setError(result.error)
					}
					if (emailChanged) {
						const result = await attempt(() => requestEmailChange(emailValue, password))
						if (!result) return
						if (!result.ok) return setError(result.error)
						setEmailValue(email)
						setPassword("")
						notify(`Bestätigungslink an ${emailValue.trim().toLowerCase()} gesendet`)
					} else {
						notify("Gespeichert")
					}
					router.refresh()
				})
			}}
		>
			<label htmlFor="account-name">Name</label>
			<input id="account-name" autoComplete="name" value={nameValue} onChange={(event) => setNameValue(event.target.value)} required />
			<label htmlFor="account-email">E-Mail</label>
			<input id="account-email" type="email" autoComplete="email" value={emailValue} onChange={(event) => setEmailValue(event.target.value)} required />
			{pendingEmail && !emailChanged && (
				<p className="notice text-sm">
					Wartet auf Bestätigung: <strong>{pendingEmail}</strong>. Bis du auf den Link in der E-Mail klickst, gilt die bisherige Adresse.{" "}
					<button
						type="button"
						// im Fließtext: keine eigene Zeilenhöhe, die Tippfläche wächst nur über das Padding
						className="btn-link inline! min-h-0! -my-3 py-3 text-sm"
						onClick={() =>
							startTransition(async () => {
								if ((await attempt(() => cancelEmailChange().then(() => true))) !== undefined) router.refresh()
							})
						}
					>
						Änderung verwerfen
					</button>
				</p>
			)}
			{emailChanged && (
				<>
					<label htmlFor="account-email-password">Aktuelles Passwort (zur Bestätigung)</label>
					<input id="account-email-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
				</>
			)}
			{error && <p className="error">{error}</p>}
			<button type="submit" className="min-h-11 self-start" disabled={pending || (!nameChanged && !emailChanged)}>
				Speichern
			</button>
		</form>
	)
}

// Passwort ändern: altes zur Bestätigung, neues zweimal (Abgleich schon beim Tippen)
export function PasswordForm() {
	const { attempt, notify } = useFeedback()
	const [oldPassword, setOldPassword] = useState("")
	const [newPassword, setNewPassword] = useState("")
	const [repeat, setRepeat] = useState("")
	const [error, setError] = useState<string | null>(null)
	const [pending, startTransition] = useTransition()
	const tooShort = newPassword.length > 0 && newPassword.length < 8
	const mismatch = repeat.length > 0 && repeat !== newPassword

	return (
		<form
			className="form max-w-none gap-3"
			onSubmit={(event) => {
				event.preventDefault()
				setError(null)
				startTransition(async () => {
					const result = await attempt(() => changePassword(oldPassword, newPassword, repeat))
					if (!result) return
					if (!result.ok) return setError(result.error)
					setOldPassword("")
					setNewPassword("")
					setRepeat("")
					notify("Passwort geändert")
				})
			}}
		>
			<label htmlFor="password-old">Altes Passwort</label>
			<input id="password-old" type="password" autoComplete="current-password" value={oldPassword} onChange={(event) => setOldPassword(event.target.value)} required />
			<label htmlFor="password-new">Neues Passwort</label>
			<input
				id="password-new"
				type="password"
				autoComplete="new-password"
				minLength={8}
				aria-describedby="password-new-hint"
				value={newPassword}
				onChange={(event) => setNewPassword(event.target.value)}
				required
			/>
			<p id="password-new-hint" className={`-mt-2 text-sm ${tooShort ? "error" : "opacity-70"}`}>
				Mindestens 8 Zeichen
			</p>
			<label htmlFor="password-repeat">Neues Passwort wiederholen</label>
			<input
				id="password-repeat"
				type="password"
				autoComplete="new-password"
				aria-invalid={mismatch}
				aria-describedby="password-repeat-hint"
				value={repeat}
				onChange={(event) => setRepeat(event.target.value)}
				required
			/>
			<p id="password-repeat-hint" aria-live="polite" className={`-mt-2 text-sm ${mismatch ? "error" : "text-emerald-700 dark:text-emerald-400"}`}>
				{mismatch ? "Stimmt nicht überein" : repeat && repeat === newPassword ? "Stimmt überein" : ""}
			</p>
			{error && <p className="error">{error}</p>}
			<button type="submit" className="min-h-11 self-start" disabled={pending || !oldPassword || newPassword.length < 8 || repeat !== newPassword}>
				Passwort ändern
			</button>
		</form>
	)
}
