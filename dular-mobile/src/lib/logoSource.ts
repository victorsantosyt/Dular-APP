const remoteLogo = process.env.EXPO_PUBLIC_LOGO_URL;

let fallback: any;
try {
  // Coloque o arquivo em assets/dular-hero.png para usar a imagem fornecida.
  fallback = require("../../assets/dular-hero.png");
} catch {
  // Fallback para o ícone padrão caso o arquivo ainda não esteja presente.
  fallback = require("../../assets/icon.png");
}

export const logoSource = remoteLogo ? { uri: remoteLogo } : fallback;
