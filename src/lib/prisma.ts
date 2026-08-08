import { PrismaClient } from "../generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const globalsForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

const connectionString = process.env.DATABASE_URL

function newConnection() {
	const adapter = new PrismaPg({ connectionString })

	return new PrismaClient({
		adapter,
	})
}

export const prisma = globalsForPrisma.prisma ?? newConnection()

if (process.env.NODE_ENV !== "production") {
	globalsForPrisma.prisma = prisma
}
