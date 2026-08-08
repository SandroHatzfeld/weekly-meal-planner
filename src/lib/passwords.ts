import { compare, hash } from "bcrypt"

const saltRounds = 10

export const hashPassword = async (plaintextPassword: string) => {
	return await hash(plaintextPassword, saltRounds)
}

export const verifyPassword = async ({
	plaintextPassword,
	userPasswordHash,
}: {
	plaintextPassword: string
	userPasswordHash: string
}) => {
	return await compare(plaintextPassword, userPasswordHash)
}