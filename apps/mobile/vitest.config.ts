import { defineConfig } from "vitest/config";

// Logique pure testée telle quelle ; les futurs `*.web.test.tsx` rendent les composants
// avec react-native-web (même pattern que packages/ui/vitest.config.ts).
export default defineConfig({
  resolve: {
    alias: [{ find: /^react-native$/, replacement: "react-native-web" }],
    extensions: [".web.tsx", ".web.ts", ".web.js", ".tsx", ".ts", ".mjs", ".js", ".jsx", ".json"],
  },
  define: { __DEV__: "false" },
  test: {
    server: { deps: { inline: [/expo-/, /react-native-svg/, /react-native-web/] } },
  },
});
