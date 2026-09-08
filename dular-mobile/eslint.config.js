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
    rules: {
      // O app exporta de propósito o nome E o default do mesmo componente
      // (`export function X` + `export default X`), para os dois estilos de
      // import funcionarem. Esta regra avisava em 12 imports por causa disso —
      // todos corretos. Um lint que aponta 12 não-problemas ensina a ignorar
      // lint, então ela sai.
      "import/no-named-as-default": "off",
    },
  },
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
