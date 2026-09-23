// PGlite (Postgres embarqué en WASM) est démarré dans de nombreux tests (une instance en mémoire
// par cas, migrations comprises) ; sous forte charge parallèle, le délai par défaut (5 s) peut
// être dépassé sans que ce soit un bug. On l'augmente et on borne le parallélisme des fichiers.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 20_000,
    hookTimeout: 20_000,
    // Un fichier à la fois : évite d'ouvrir des dizaines d'instances PGlite en parallèle.
    fileParallelism: false,
  },
});
