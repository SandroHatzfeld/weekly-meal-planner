import { createHash, randomBytes } from "crypto"

// hochentropische Zufallstokens -> SHA-256 reicht als Hash (kein bcrypt nötig)
export const generateToken = (prefix = "") => prefix + randomBytes(32).toString("base64url")

export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex")
