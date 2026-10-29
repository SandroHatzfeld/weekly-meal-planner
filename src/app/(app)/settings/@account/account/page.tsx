import { ApiTokens } from "@/components/settings/SettingsControls"
import SettingsSection from "@/components/settings/SettingsSection"
import SettingsBackLink from "@/components/settings/SettingsBackLink"
import HintsToggle from "@/components/hints/HintsToggle"
import { PasswordForm, ProfileForm } from "@/components/settings/AccountForms"
import InstallButton from "@/components/pwa/InstallButton"
import { signOut } from "@/lib/auth/auth"
import { prisma } from "@/lib/prisma"
import { requireActivePlan } from "@/lib/session"
import { hintsEnabled } from "@/lib/user/hint-keys"

const formatDate = (date: Date) => new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(date)

// Einstellungen des eigenen Kontos (gelten für alle Pläne)
export default async function AccountSettingsPage() {
	const { user } = await requireActivePlan()
	const account = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { name: true, email: true, dismissedHints: true } })
	// offene Änderung der E-Mail-Adresse (Bestätigungslink noch nicht geklickt)
	const pendingChange = await prisma.emailVerificationToken.findFirst({
		where: { userId: user.id, newEmail: { not: null }, expiresAt: { gt: new Date() } },
		select: { newEmail: true },
	})
	const apiTokens = await prisma.apiToken.findMany({
		where: { userId: user.id },
		select: { id: true, name: true, createdAt: true, lastUsedAt: true },
		orderBy: { createdAt: "desc" },
	})

	return (
		<div className="space-y-4">
			<SettingsBackLink />

			<section className="card space-y-3">
				<h2 className="text-lg font-semibold">Profil</h2>
				<ProfileForm name={account.name} email={account.email} pendingEmail={pendingChange?.newEmail ?? null} />
			</section>

			<section className="card space-y-3">
				<h2 className="text-lg font-semibold">Passwort ändern</h2>
				<PasswordForm />
			</section>
			<section className="card">
				<HintsToggle enabled={hintsEnabled(account.dismissedHints)} />
			</section>

			<SettingsSection
				title="API-Tokens"
				description={
					<>
						Für Home Assistant, Shortcuts & Co. Ein Token gewährt Zugriff auf die Einkaufslisten aller deiner Pläne (<code>Authorization: Bearer …</code> an{" "}
						<code>/api/external/…</code>).
					</>
				}
			>
				<ApiTokens
					tokens={apiTokens.map((token) => ({
						id: token.id,
						name: token.name,
						createdAt: formatDate(token.createdAt),
						lastUsedAt: token.lastUsedAt ? formatDate(token.lastUsedAt) : null,
					}))}
				/>
			</SettingsSection>

			<InstallButton />
			<form
				action={async () => {
					"use server"
					await signOut({ redirectTo: "/login" })
				}}
			>
				<button type="submit" className="btn-secondary">
					Abmelden
				</button>
			</form>
		</div>
	)
}
