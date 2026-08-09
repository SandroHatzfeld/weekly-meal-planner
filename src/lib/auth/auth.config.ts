import { NextAuthConfig } from "next-auth"

export const authConfig: NextAuthConfig = {
	pages: { signIn: "/login" },
	callbacks: {
		authorized({ auth, request }) {
			const isLoggedIn = !!auth?.user
			const isPublicRoute = ["/login", "/register"].includes(request.nextUrl.pathname)
			if(isPublicRoute) return true
			return isLoggedIn
		},
	},
	providers: [], // wird erst in auth.ts gefüllt
}
