import type { DefaultSession } from "next-auth"

declare module "next-auth" {
	interface Session {
		user: DefaultSession["user"] & { id: string; activePlanId: string | null }
	}
}

declare module "@auth/core/jwt" {
	interface JWT {
		id: string
		activePlanId: string | null
	}
}
