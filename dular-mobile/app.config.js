// extra.apiBaseUrl segue a API do perfil de build (eas.json), para que o
// artefato de homologação não leve a URL de produção nem como alternativa.
// Sem a variável (desenvolvimento local), vale o valor do app.json.
module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    apiBaseUrl: process.env.EXPO_PUBLIC_API_URL ?? config.extra.apiBaseUrl,
  },
});
