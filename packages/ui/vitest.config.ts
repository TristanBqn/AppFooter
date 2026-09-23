import { defineConfig } from "vitest/config";

// Les tests `*.web.test.tsx` rendent les composants avec react-native-web (aperçu web Expo).
export default defineConfig({
  resolve: {
    alias: [
      { find: /^react-native$/, replacement: "react-native-web" },
      // Point d'entrée web de react-native-svg (celui que Metro choisit pour la plateforme web).
      { find: /^react-native-svg$/, replacement: "react-native-svg/lib/module/ReactNativeSVG.web.js" },
    ],
    extensions: [".web.tsx", ".web.ts", ".web.js", ".tsx", ".ts", ".mjs", ".js", ".jsx", ".json"],
  },
  define: { __DEV__: "false" },
  test: {
    server: { deps: { inline: [/expo-/, /react-native-svg/, /react-native-web/] } },
  },
});
