# Security Debt — Dular

Inventário de vulnerabilidades **conhecidas, transitivas e não resolvidas**
no momento, com decisão explícita de adiar correção até o próximo upgrade
planejado de Prisma, Next ou Expo.

> **Regra absoluta — NÃO usar `npm audit fix --force`.**
> Todos os fixes automáticos disponíveis introduzem breaking changes em
> Prisma, Next ou Expo (downgrade do Next para 9.x, upgrade major do Expo
> para 56.0.8 etc.). Nenhum é aceitável fora de um upgrade controlado.

Última auditoria: `npm audit` rodado em 2026-06-03 a partir de
`web/` e `dular-mobile/` (Node 20). Reproduza com os comandos da seção
[Verificação](#verificação).

---

## Resumo

| Origem | Pacote afetado | Severidade | Cadeia transitiva | Upgrade que resolve |
|---|---|---|---|---|
| web | `@hono/node-server` (<1.19.13) | moderate | `prisma → @prisma/dev → @hono/node-server` | Major upgrade do Prisma (≥ 6.20.x / 7.x) |
| web | `postcss` (<8.5.10) | moderate | `next-auth → next → postcss` | Major upgrade do Next |
| mobile | `postcss` (<8.5.10) | moderate | `expo → @expo/cli → @expo/metro-config → postcss` | Major upgrade do Expo |
| mobile | `uuid` (<11.1.1) | moderate | `expo-splash-screen / expo-asset / expo-notifications → expo-constants → @expo/config → @expo/config-plugins → xcode → uuid` | Major upgrade do Expo |

> `npm audit` reporta múltiplos nós por cadeia (6 em web, 13 em mobile),
> mas as **causas raiz são as 4 acima**. Bumps internos de cada pacote
> intermediário apenas refletem o mesmo problema upstream.

---

## Detalhamento

### 1. `@hono/node-server` (web) — GHSA-92pp-h63x-v22m

- **CVE/Aviso**: <https://github.com/advisories/GHSA-92pp-h63x-v22m>
- **Descrição**: Middleware bypass via repeated slashes em `serveStatic`.
- **Cadeia**: `prisma@7.8.0 → @prisma/dev → @hono/node-server`.
- **Por que não corrigimos agora**:
  - O único caminho de fix automático (`npm audit fix --force`) faria
    downgrade do Prisma para `6.19.3`, breaking change em schema e
    client gerado. Inaceitável fora de planejamento de upgrade.
  - Restrição vigente: **não atualizar Prisma**.
- **Upgrade futuro que resolve**: bump major do Prisma quando o cliente
  trouxer `@prisma/dev ≥ 0.24.9` (com `@hono/node-server ≥ 1.19.13`).
- **Impacto real no Dular**:
  - `@prisma/dev` é **dev tooling** (CLI/dev server local). Não roda em
    produção, não é importado por código de runtime, não é deployado.
  - Vulnerabilidade exige expor `serveStatic` do Hono publicamente — não
    fazemos isso em nenhum endpoint.
- **Mitigação atual**:
  - Restringir uso a desenvolvedor local.
  - Não expor `@prisma/dev` em CI nem em containers de runtime.
  - `npm ci` em CI mantém versão lockada — sem drift acidental.

### 2. `postcss` (web) — GHSA-qx2v-qp2m-jg93

- **CVE/Aviso**: <https://github.com/advisories/GHSA-qx2v-qp2m-jg93>
- **Descrição**: XSS via unescaped `</style>` em CSS stringify output.
- **Cadeia**: `next-auth → next → postcss` (dentro de
  `node_modules/next/node_modules/postcss`).
- **Por que não corrigimos agora**:
  - Fix automático tenta `next@9.3.3` (downgrade catastrófico).
  - Restrição vigente: **não atualizar Next**.
- **Upgrade futuro que resolve**: bump major do Next quando trouxer
  `postcss ≥ 8.5.10` no bundle interno.
- **Impacto real no Dular**:
  - PostCSS rodando em **build-time** dentro do Next. A vulnerabilidade
    exige CSS controlado por atacante ser passado pelo pipeline — o
    Dular não processa CSS de input do usuário.
  - Nenhum endpoint emite CSS a partir de dados não confiáveis.
- **Mitigação atual**:
  - Não aceitar nem renderizar CSS vindo de payload de usuário.
  - Build de produção é determinístico (`npm ci` + `next build` em CI).

### 3. `postcss` (mobile) — GHSA-qx2v-qp2m-jg93

- **Mesma CVE acima.**
- **Cadeia**: `expo → @expo/cli → @expo/metro-config → postcss`.
- **Por que não corrigimos agora**:
  - Fix automático tenta `expo@56.0.8` (downgrade do SDK).
  - Restrição vigente: **não atualizar Expo**.
- **Upgrade futuro que resolve**: bump major do Expo quando trouxer
  `@expo/metro-config` com `postcss ≥ 8.5.10`.
- **Impacto real no Dular**:
  - PostCSS no mobile vive em **dev tooling do Metro** — não roda dentro
    do app empacotado, não é shipped no IPA/APK.
  - App mobile não processa CSS de runtime.
- **Mitigação atual**:
  - Build de release controlado (EAS).
  - Sem CSS dinâmico no runtime mobile.

### 4. `uuid` (mobile) — GHSA-w5hq-g745-h8pq

- **CVE/Aviso**: <https://github.com/advisories/GHSA-w5hq-g745-h8pq>
- **Descrição**: Missing buffer bounds check em v3/v5/v6 quando `buf` é
  fornecido.
- **Cadeia**: `expo-splash-screen / expo-asset / expo-notifications →
  expo-constants → @expo/config → @expo/config-plugins → xcode → uuid`.
- **Por que não corrigimos agora**:
  - Fix automático tenta `expo@56.0.8` (downgrade).
  - Restrição vigente: **não atualizar Expo**.
- **Upgrade futuro que resolve**: bump major do Expo (config-plugins
  modernos arrastam `uuid ≥ 11.1.1`).
- **Impacto real no Dular**:
  - `xcode` é tooling de **prebuild iOS** (gera projeto Xcode antes do
    build nativo). Roda em build, não no app empacotado.
  - O Dular usa Expo managed workflow + EAS — `xcode` só roda em
    prebuild local/EAS, com input controlado pela própria toolchain
    Expo (não payload externo).
  - O bug exige `buf` fornecido por chamador hostil — não há vetor de
    input externo nesse caminho.
- **Mitigação atual**:
  - Build mobile é determinístico (EAS Build) — sem entrada externa
    no prebuild além do próprio repositório.

---

## Verificação

```bash
# Web
cd web
npm audit               # NÃO usar --force; NÃO usar audit fix

# Mobile
cd dular-mobile
npm audit               # idem
```

Esperado em 2026-06-03:
- web → 6 moderate (4 chains, 2 root causes: `@hono/node-server`, `postcss`)
- mobile → 13 moderate (2 root causes: `postcss`, `uuid`)

Qualquer **alteração na quantidade ou no conjunto de pacotes raiz** deve
ser tratada como sinal: revalidar este documento, confirmar se é nova
vulnerabilidade transitiva no mesmo caminho ou se algo realmente novo
entrou. **Não silenciar sem revisar.**

---

## Dependabot

A configuração em [`.github/dependabot.yml`](../.github/dependabot.yml)
ignora **apenas** os 4 pacotes acima, com comentários explicando o
motivo e a condição de fim (upgrade Prisma/Next/Expo).

Qualquer **outra** vulnerabilidade (direta de runtime, dependência
crítica, severidade `high`/`critical`, ou pacote fora desta lista) deve
abrir alerta Dependabot normalmente.

---

## Quando reabrir

Reabrir e resolver itens deste documento **somente** dentro de um
planejamento explícito de upgrade:

1. **Prisma major upgrade** → resolve item 1 (`@hono/node-server`).
2. **Next major upgrade** → resolve item 2 (`postcss` web).
3. **Expo major upgrade** → resolve itens 3 e 4 (`postcss` mobile e
   `uuid`).

Cada upgrade tem fluxo próprio (migração de schema, validação E2E,
EAS rebuild). Não combinar com correções de vulnerabilidade fora do
plano de upgrade.

---

## Histórico

| Data | Quem | O que mudou |
|---|---|---|
| 2026-06-03 | Fase 1I | Documento inicial. 4 causas raiz mapeadas, Dependabot configurado com ignore escopado. |
