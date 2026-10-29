"use client"

import { useFeedback } from "@/components/ui/Feedback"
import Icon, { iconButtonClass } from "@/components/ui/Icon"
import {
	invitePerson,
	leavePlan,
	regenerateGenericInvite,
	removeMember,
	renamePlan,
	revokePersonalInvite,
} from "@/lib/plan/actions"
import { createApiToken, deleteApiToken } from "@/lib/tokens/actions"
import { useActionState, useState, useTransition } from "react"

export function PlanNameForm({ planId, name }: { planId: string; name: string }) {
	const [value, setValue] = useState(name)
	const [pending, startTransition] = useTransition()
	return (
		<form
			className="space-y-1"
			onSubmit={(event) => {
				event.preventDefault()
				startTransition(() => renamePlan(planId, value))
			}}
		>
			<label htmlFor="plan-name" className="block text-sm font-medium">
				Name
			</label>
			<div className="flex gap-2">
				<input id="plan-name" className="input flex-1" value={value} onChange={(event) => setValue(event.target.value)} required />
				<button type="submit" className="btn" disabled={pending || value === name}>
					Umbenennen
				</button>
			</div>
		</form>
	)
}

export function RemoveMemberButton({ planId, userId, name }: { planId: string; userId: string; name: string }) {
	const [pending, startTransition] = useTransition()
	const { confirm } = useFeedback()
	return (
		<button
			type="button"
			className={`${iconButtonClass} text-red-600`}
			aria-label={`${name} aus dem Plan entfernen`}
			title="Aus dem Plan entfernen"
			disabled={pending}
			onClick={async () => {
				if (await confirm({ title: `${name} aus dem Plan entfernen?`, confirmLabel: "Entfernen", danger: true })) startTransition(() => removeMember(planId, userId))
			}}
		>
			<Icon name="trash" />
		</button>
	)
}

export function LeavePlanButton({ planId, isLastMember }: { planId: string; isLastMember: boolean }) {
	const [pending, startTransition] = useTransition()
	const { confirm } = useFeedback()
	return (
		<button
			type="button"
			className="btn-danger"
			disabled={pending}
			onClick={async () => {
				const confirmed = await confirm({
					title: "Plan verlassen?",
					message: isLastMember ? "Du bist das letzte Mitglied – der Plan wird mit allen Gerichten und Listen gelöscht." : undefined,
					confirmLabel: isLastMember ? "Verlassen und löschen" : "Verlassen",
					danger: true,
				})
				if (confirmed) startTransition(() => leavePlan(planId))
			}}
		>
			Plan verlassen
		</button>
	)
}

export function InviteForm({ planId }: { planId: string }) {
	const [state, formAction, pending] = useActionState(invitePerson.bind(null, planId), undefined)
	return (
		<form action={formAction} className="space-y-1">
			<div className="flex gap-2">
				<input type="email" name="email" className="input flex-1" placeholder="E-Mail der Person" required />
				<button type="submit" className="btn" disabled={pending}>
					Einladen
				</button>
			</div>
			{state?.error && <p className="error">{state.error}</p>}
			{state?.success && <p className="text-sm text-emerald-700">{state.success}</p>}
		</form>
	)
}

export function RevokeInviteButton({ planId, inviteId }: { planId: string; inviteId: string }) {
	const [pending, startTransition] = useTransition()
	return (
		<button type="button" className="btn-link text-xs" disabled={pending} onClick={() => startTransition(() => revokePersonalInvite(planId, inviteId))}>
			Zurückziehen
		</button>
	)
}

export function GenericInvite({ planId, link, expiresAt }: { planId: string; link: string | null; expiresAt: string | null }) {
	const { confirm } = useFeedback()
	const [pending, startTransition] = useTransition()
	return (
		<div className="space-y-1 text-sm">
			<div className="font-semibold">Allgemeiner Einladungslink</div>
			{link ? (
				<>
					<div className="flex gap-2">
						<input readOnly aria-label="Einladungslink" className="input flex-1 font-mono text-xs" value={link} onFocus={(event) => event.target.select()} />
						<button type="button" className="btn-secondary" onClick={() => navigator.clipboard.writeText(link)}>
							Kopieren
						</button>
					</div>
					<div className="opacity-60">gültig bis {expiresAt}</div>
				</>
			) : (
				<div className="opacity-60">Kein aktiver Link</div>
			)}
			<button
				type="button"
				className="btn-secondary"
				disabled={pending}
				onClick={async () => {
					if (!link || (await confirm({ title: "Neuen Link erstellen?", message: "Der alte Link wird dabei ungültig.", confirmLabel: "Neu generieren" })))
						startTransition(() => regenerateGenericInvite(planId))
				}}
			>
				{link ? "Neu generieren" : "Link erstellen"}
			</button>
		</div>
	)
}

type TokenRow = { id: string; name: string; createdAt: string; lastUsedAt: string | null }

export function ApiTokens({ tokens }: { tokens: TokenRow[] }) {
	const { confirm } = useFeedback()
	const [name, setName] = useState("")
	const [created, setCreated] = useState<string | null>(null)
	const [pending, startTransition] = useTransition()

	return (
		<div className="space-y-2">
			{created && (
				<div className="notice text-sm">
					Dein neuer Token – er wird nur dieses eine Mal angezeigt:
					<input readOnly aria-label="Neues API-Token" className="input mt-1 font-mono text-xs" value={created} onFocus={(event) => event.target.select()} />
				</div>
			)}
			<form
				className="flex gap-2"
				onSubmit={(event) => {
					event.preventDefault()
					startTransition(async () => {
						const result = await createApiToken(name)
						if (result.token) {
							setCreated(result.token)
							setName("")
						}
					})
				}}
			>
				<input className="input flex-1" placeholder="Name, z.B. Home Assistant" value={name} onChange={(event) => setName(event.target.value)} required />
				<button type="submit" className="btn" disabled={pending}>
					Token erstellen
				</button>
			</form>
			<ul className="text-sm">
				{tokens.map((token) => (
					<li key={token.id} className="flex items-center gap-2 py-1">
						<span className="flex-1">
							{token.name}{" "}
							<span className="opacity-60">
								erstellt {token.createdAt}, {token.lastUsedAt ? `zuletzt genutzt ${token.lastUsedAt}` : "nie genutzt"}
							</span>
						</span>
						<button
							type="button"
							className={`${iconButtonClass} text-red-600`}
							aria-label={`Token ${token.name} widerrufen`}
							title="Widerrufen"
							onClick={async () => {
								if (await confirm({ title: `Token „${token.name}“ widerrufen?`, message: "Geräte und Dienste mit diesem Token (z.B. Home Assistant) verlieren den Zugriff.", confirmLabel: "Widerrufen", danger: true }))
									startTransition(() => deleteApiToken(token.id))
							}}
						>
							<Icon name="trash" />
						</button>
					</li>
				))}
			</ul>
		</div>
	)
}

