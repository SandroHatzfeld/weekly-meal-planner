import { PrismaAdapter } from "@auth/prisma-adapter"
import NextAuth, { NextAuthConfig } from "next-auth"
import CredentialProvider from "next-auth/providers/credentials"
import { prisma } from "../prisma"
import { verifyPassword } from "../password"
import { authConfig } from "./auth.config"

export const authOptions: NextAuthConfig = {
	...authConfig,
	adapter: PrismaAdapter(prisma),
	session: { strategy: "jwt" as const },
	providers: [
		CredentialProvider({
			name: "Credentials",
			credentials: {
				email: { label: "E-Mail", type: "email", placeholder: "E-Mails Adresse" },
				password: { label: "Passwort", type: "password" },
			},
			async authorize(credentials) {
				if (typeof credentials.email !== "string" || typeof credentials.password !== "string") return null

				const user = await prisma.user.findUnique({ where: { email: credentials.email } })
				if (!user) return null

				const passwordVerification = await verifyPassword({
					plaintextPassword: credentials.password,
					userPasswordHash: user.passwordHash,
				})
				if (!passwordVerification) return null

				return { id: user.id, email: user.email, name: user.name }
			},
		}),
	],
	callbacks: {
		...authConfig.callbacks,
		async jwt({token, user}) {
			if (user?.id) {
				token.id = user.id
			}
			return token
		},
		async session({session, token}) {
			session.user.id = token.id
			return session
		},
	},
}

export const { handlers, signIn, signOut, auth } = NextAuth(authOptions)