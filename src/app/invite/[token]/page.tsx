import InviteRegisterForm from "@/components/auth/InviteRegisterForm"
import { auth } from "@/lib/auth/auth"
import { acceptInvite } from "@/lib/invite/actions"
import { findUsableInvite } from "@/lib/invite/invite"
import { prisma } from "@/lib/prisma"
import Link from "next/link"

export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
	const { token } = await params
	const invite = await findUsableInvite(token)

	if (!invite) {
		return (
			<main className="auth-page">
				<h1>Einladung ungültig</h1>
				<p>Diese Einladung ist abgelaufen, wurde bereits verwendet oder zurückgezogen.</p>
				<Link href="/">Zur Startseite</Link>
			</main>
		)
	}

	const session = await auth()
	const loginLink = `/login?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`

	// eingeloggt: ein Klick zum Beitreten
	if (session?.user) {
		const alreadyMember = await prisma.planMember.findUnique({
			where: { userId_planId: { userId: session.user.id, planId: invite.planId } },
		})
		const wrongAccount = invite.type === "PERSONAL" && invite.email !== session.user.email
		return (
			<main className="auth-page">
				<h1>Einladung zu „{invite.plan.name}“</h1>
				{alreadyMember ? (
					<p>
						Du bist bereits Mitglied. <Link href="/">Zum Plan</Link>
					</p>
				) : wrongAccount ? (
					<p>Diese Einladung gilt für {invite.email}. Bitte melde dich mit diesem Account an.</p>
				) : (
					<form action={acceptInvite.bind(null, token)}>
						<button type="submit">Plan beitreten</button>
					</form>
				)}
			</main>
		)
	}

	// Account existiert bereits -> einloggen, danach automatisch zurück hierher
	const existingAccount = invite.email ? await prisma.user.findUnique({ where: { email: invite.email } }) : null

	return (
		<main className="auth-page">
			<h1>Einladung zu „{invite.plan.name}“</h1>
			{existingAccount ? (
				<p>
					Für {invite.email} gibt es bereits einen Account. <Link href={loginLink}>Einloggen und beitreten</Link>
				</p>
			) : (
				<>
					<p>Lege einen Account an, um dem Plan beizutreten.</p>
					<InviteRegisterForm token={token} email={invite.type === "PERSONAL" ? invite.email : null} />
					<p>
						Schon einen Account? <Link href={loginLink}>Einloggen</Link>
					</p>
				</>
			)}
		</main>
	)
}
