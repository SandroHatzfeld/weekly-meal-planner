import { PrismaAdapter } from "@auth/prisma-adapter"
import NextAuth from "next-auth"
import CredentialProvider from "next-auth/providers/credentials"
import { prisma } from "./prisma"
import { verifyPassword } from "./password"

export const authOptions = {
	providers: [
		CredentialProvider({
			name: "Credentials",
			credentials: {
				username: { label: "E-Mail", type: "email", placeholder: "E-Mails Adresse" },
				password: { label: "Passwort", type: "password" },
			},
		}),
	],
}

export default NextAuth(authOptions)
