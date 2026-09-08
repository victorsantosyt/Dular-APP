// Flat config (formato padrão do ESLint 9, usado pelo Expo a partir do SDK 53).
//
// O app não tinha lint nenhum: sem config, sem dependência e sem script — o
// `npx eslint` puxava uma cópia avulsa do registro e falhava. Agora usa o
// `eslint-config-expo`, que já traz as regras de React, React Hooks e React
// Native alinhadas com a versão do SDK.
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      "node_modules/*",
      ".expo/*",
      "dist/*",
      "android/*",
      "ios/*",
      "assets/*",
    ],
  },
]);
