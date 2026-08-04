import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { Prisma } from "@prisma/client/extension"

export const { handlers, signIn, signOut, auth } = NextAuth({
	adapter: PrismaAdapter(Prisma),
	session: {strategy: "jwt"},
	providers: [Credentials({})],
	callbacks: {}
})

