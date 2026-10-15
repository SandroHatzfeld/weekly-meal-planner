import { NextAuthConfig } from "next-auth"

// Seiten, die ohne Login erreichbar sein müssen
const publicRoutes = ["/login", "/register", "/register/check-mail", "/verify"]
const publicPrefixes = ["/invite/"]

export const authConfig: NextAuthConfig = {
	pages: { signIn: "/login" },
	// self-hosted hinter nginx: Host-Header vertrauen
	trustHost: true,
	callbacks: {
		authorized({ auth, request }) {
			const isLoggedIn = !!auth?.user
			const { pathname } = request.nextUrl
			const isPublicRoute =
				publicRoutes.includes(pathname) || publicPrefixes.some((prefix) => pathname.startsWith(prefix))
			if (isPublicRoute) return true
			return isLoggedIn
		},
	},
	providers: [], // wird erst in auth.ts gefüllt
}
