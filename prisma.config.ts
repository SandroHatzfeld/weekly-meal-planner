import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // process.env statt env(): `prisma generate` im Docker-Build läuft ohne DATABASE_URL,
    // env() würde dort abbrechen. Migrate-Befehle brauchen die Variable weiterhin.
    url: process.env.DATABASE_URL ?? "",
  },
});
