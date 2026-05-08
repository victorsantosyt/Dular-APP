# Dular Mobile — Guia de Deploy (EAS Build)

## Variáveis de Ambiente

Crie `.env` a partir de `.env.example` e preencha antes de cada build:

| Variável | Obrigatória | Descrição |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | ✅ | URL base da API de produção (ex: `https://api.dular.app`) |
| `EXPO_PUBLIC_API_BASE_URL` | ✅ | Alias de compat — mesma URL acima |
| `EXPO_PUBLIC_PILOT_MODE` | ❌ | `true` ativa modo piloto geolocalizado |
| `EXPO_PUBLIC_PILOT_CITY` | ❌ | Cidade do piloto (ex: `Cuiabá`) |
| `EXPO_PUBLIC_PILOT_UF` | ❌ | Estado do piloto (ex: `MT`) |
| `EXPO_PUBLIC_PILOT_LAT` | ❌ | Latitude central do piloto |
| `EXPO_PUBLIC_PILOT_LNG` | ❌ | Longitude central do piloto |
| `EXPO_PUBLIC_PILOT_BAIRROS` | ❌ | Lista de bairros atendidos, separada por vírgula |
| `EXPO_PUBLIC_SOS_WHATSAPP` | ❌ | Número WhatsApp SOS sem `+` (ex: `5565999999999`) |
| `EXPO_PUBLIC_MONEY_UNIT` | ❌ | Símbolo monetário exibido na UI (padrão `R$`) |
| `EXPO_PUBLIC_LOGO_URL` | ❌ | URL do logo remoto (fallback para asset local) |

> **Atenção:** `sosWhatsapp` e `apiBaseUrl` também estão em `app.json > extra`.
> Atualize-os manualmente antes de publicar (ou via `app.config.ts` lendo `.env`).

## Checklist EAS Build

```
# 1. Instalar EAS CLI
npm install -g eas-cli

# 2. Login na conta Expo
eas login

# 3. Inicializar projeto (primeira vez)
eas init

# 4. Configurar credenciais
eas credentials

# 5. Build de preview interno (sem loja)
eas build --platform all --profile preview

# 6. Build de produção (loja)
eas build --platform all --profile production

# 7. Submit para lojas
eas submit --platform ios
eas submit --platform android
```

### Antes de cada build de produção, verificar:

- [ ] `app.json` > `version` incrementado
- [ ] `app.json` > `ios.buildNumber` incrementado
- [ ] `app.json` > `android.versionCode` incrementado
- [ ] `app.json` > `extra.apiBaseUrl` aponta para a URL de produção
- [ ] `app.json` > `extra.sosWhatsapp` configurado
- [ ] `.env` criado a partir de `.env.example` com valores reais
- [ ] Certificados iOS atualizados (`eas credentials`)
- [ ] Keystore Android válida (`eas credentials`)
- [ ] `eas.json` presente na raiz do projeto (ver seção abaixo)

## eas.json mínimo

```json
{
  "cli": { "version": ">= 12.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "production": {}
  },
  "submit": {
    "production": {}
  }
}
```

## Dívidas Técnicas

| # | Item | Impacto | Prioridade |
|---|---|---|---|
| 1 | `OAuthLogin.tsx` e `LoginScreen.tsx` coexistem com fluxos sobrepostos — unificar em uma única tela de login | Manutenibilidade | Alta |
| 2 | Navegadores usam `createBottomTabNavigator` sem `tabBar` para simular stack — migrar para `createNativeStackNavigator` | Performance / UX | Média |
| 3 | `DiaristaNavigator > Novo` aponta para `AgendamentosDiaristaScreen` (duplicata de `Agendamentos`) | Correto mas confuso | Baixa |
| 4 | `sosWhatsapp` lido via `Constants.expoConfig.extra` — migrar para variável `EXPO_PUBLIC_` com tipagem | DX / Segurança | Média |
| 5 | Push notifications: `projectId` hardcoded como `"com.dular.app"` em `usePushNotifications.ts` — ler de `Constants.expoConfig.extra` | Robustez | Média |
| 6 | Ausência de testes automatizados (unitários e E2E) | Qualidade | Alta |
| 7 | `_legacy/` folder com código morto — remover após confirmação de não-uso | Limpeza | Baixa |
