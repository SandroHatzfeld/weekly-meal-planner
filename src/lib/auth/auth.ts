import { PrismaAdapter } from "@auth/prisma-adapter"
import NextAuth, { CredentialsSignin, NextAuthConfig } from "next-auth"
import CredentialProvider from "next-auth/providers/credentials"
import { prisma } from "../prisma"
import { verifyPassword } from "../password"
import { consumeVerificationToken } from "../verification"
import { authConfig } from "./auth.config"

export class EmailNotVerifiedError extends CredentialsSignin {
	code = "email_not_verified"
}

export const authOptions: NextAuthConfig = {
	...authConfig,
	adapter: PrismaAdapter(prisma),
	session: { strategy: "jwt" as const },
	providers: [
		CredentialProvider({
			id: "credentials",
			name: "Credentials",
			credentials: {
				email: { label: "E-Mail", type: "email", placeholder: "E-Mails Adresse" },
				password: { label: "Passwort", type: "password" },
			},
			async authorize(credentials) {
				if (typeof credentials.email !== "string" || typeof credentials.password !== "string") return null

				const user = await prisma.user.findUnique({ where: { email: credentials.email.trim().toLowerCase() } })
				if (!user) return null

				const passwordVerification = await verifyPassword({
					plaintextPassword: credentials.password,
					userPasswordHash: user.passwordHash,
				})
				if (!passwordVerification) return null
				if (!user.emailVerified) throw new EmailNotVerifiedError()

				return { id: user.id, email: user.email, name: user.name }
			},
		}),
		// Auto-Login nach Klick auf den Verifizierungslink
		CredentialProvider({
			id: "email-token",
			name: "E-Mail-Token",
			credentials: { token: {} },
			async authorize(credentials) {
				if (typeof credentials.token !== "string") return null
				const user = await consumeVerificationToken(credentials.token)
				if (!user) return null
				return { id: user.id, email: user.email, name: user.name }
			},
		}),
	],
	callbacks: {
		...authConfig.callbacks,
		async jwt({ token, user }) {
			if (user?.id) {
				token.id = user.id
			}
			if (!token.id) return null

			// läuft bei jedem Request: Mitgliedschaften + activePlanId in einer Query lesen.
			// Dadurch greift das Entfernen aus einem Plan sofort, trotz zustandsloser JWTs.
			const dbUser = await prisma.user.findUnique({
				where: { id: token.id },
				select: {
					name: true,
					activePlanId: true,
					memberships: { select: { planId: true }, orderBy: { joinedAt: "asc" } },
				},
			})
			// Account gelöscht -> ausloggen
			if (!dbUser) return null

			const planIds = dbUser.memberships.map((membership) => membership.planId)
			// Fallback: ältester verbleibender Plan, falls activePlanId ungültig ist
			token.activePlanId =
				dbUser.activePlanId && planIds.includes(dbUser.activePlanId) ? dbUser.activePlanId : (planIds[0] ?? null)
			token.name = dbUser.name
			return token
		},
		async session({ session, token }) {
			session.user.id = token.id
			session.user.activePlanId = token.activePlanId
			if (token.name) session.user.name = token.name
			return session
		},
	},
}

export const { handlers, signIn, signOut, auth } = NextAuth(authOptions)
