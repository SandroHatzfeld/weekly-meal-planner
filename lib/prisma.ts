import { PrismaClient } from "@prisma/client/extension"

const globalsForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }
export const prisma =
	globalsForPrisma.prisma ??
	new PrismaClient({
		log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
		datasources: { db: { url: process.env.DATABASE_URL } },
	})

if (process.env.NODE_ENV !== "production") {
	globalsForPrisma.prisma = prisma
}

export * from "@prisma/client"
