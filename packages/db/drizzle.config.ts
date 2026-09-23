// Config drizzle-kit : génère les migrations SQL par diff de schéma (aucune connexion requise).
// Appliquées au démarrage de l'API via drizzle-orm (PGlite ou `pg` selon DATABASE_URL).
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./drizzle",
});
