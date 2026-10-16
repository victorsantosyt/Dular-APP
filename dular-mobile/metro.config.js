const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Código compartilhado com o servidor (ex.: shared/safescore/guia.ts) fica
// fora de dular-mobile/: o Metro só empacota o que observa. Só shared/ entra.
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, "../shared")];

module.exports = config;
