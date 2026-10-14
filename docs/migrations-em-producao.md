# Migrations em produção

O deploy de produção na Vercel aplica as migrations sozinho. O build command vem de `web/vercel.json` e roda `web/scripts/vercel-build.sh`.

## Como funciona

| Ambiente do build (`VERCEL_ENV`) | O que roda |
|---|---|
| `production` | `prisma migrate deploy` com `DATABASE_URL_UNPOOLED`, depois `npm run build` |
| `preview`, `development` ou vazio | só `npm run build` |

- A migration roda **antes** do build. Se falhar, o build falha e a versão anterior continua no ar.
- Sem `DATABASE_URL_UNPOOLED`, ou com ela apontando para o pooler (`-pooler.` no host), o script para antes de migrar. O Prisma precisa da conexão direta para migrar.
- O log mostra só o host do banco, nunca usuário ou senha.

Que tipo de deploy migra:

| Ação na Vercel | Roda build? | Migra? |
|---|---|---|
| Merge em `main` / `vercel --prod` | sim, como production | sim |
| Promote de um preview para produção | sim, rebuild com as variáveis de produção | **sim, com as migrations daquela branch**, mesmo que não estejam em `main` |
| Instant Rollback | não | não, e também não desfaz nada |
| Deploy de produção com domínio não atribuído automaticamente (staged) | sim, como production | **sim, já no build**, antes da promoção |

## Preview e Development usam o banco de staging

Desde 27/09/2026 são dois bancos Neon, dois projetos independentes, ligados pela integração da Vercel:

| Recurso | Ambientes | Conteúdo |
|---|---|---|
| `neon-coquelicot-elephant` | Production | dados reais |
| `dular-staging` | Preview e Development | só dados sintéticos (`@exemplo.test`) |

Travas (`web/src/lib/ambientePreview.ts` e `web/scripts/staging/`):

- **Build de preview**: antes de compilar, `scripts/staging/confirmar-banco.mjs` exige três evidências de que o banco é o de staging — `DULAR_DB_AMBIENTE=staging`, host igual a `DULAR_STAGING_DB_HOST` e a marca `COMMENT ON DATABASE ... IS 'dular-staging'` gravada no próprio banco. Qualquer desvio falha o build. O preview continua sem migrar.
- **Conexão de runtime**: o build e o runtime do preview conferem também a `DATABASE_URL` (pooler): mesmo host de `DATABASE_URL_UNPOOLED` sem o `-pooler`, mesmo banco e mesmo usuário. Direta de staging com runtime de produção é recusada.
- **Runtime de preview**: sem `DULAR_DB_AMBIENTE=staging` o Prisma não abre conexão; push remoto e tempo real (Ably) ficam desligados, salvo `DULAR_PUSH_PREVIEW=ligado` / `DULAR_ABLY_PREVIEW=ligado`.
- **Migração e seed do staging** (de `web/`, com as variáveis do ambiente Preview): `node scripts/staging/migrar.mjs` e `STAGING_SENHA=... npx tsx prisma/seed-staging.ts`. Os dois recusam qualquer banco sem as três evidências; o seed recusa banco que já tenha usuários. Nunca use `seed.ts` ou `copiar-contas-para-prod.ts` no staging.

**Previews criados antes de 27/09/2026 guardam as credenciais de produção** do momento do build (variáveis de um deployment não mudam depois). Não os use para testes.

## Regra 1: toda migration em `main` precisa ser aditiva

Num deploy, a migration é aplicada antes do código novo entrar no ar. Durante o build, e para sempre se o build falhar depois da migration, **o código que já está no ar roda contra o schema novo**. Então uma migration em `main` só pode fazer o que o código atual tolera:

- **Pode:** criar tabela; criar coluna opcional ou com default; criar índice; acrescentar valor a enum.
- **Não pode no mesmo deploy:** remover ou renomear coluna/tabela; tornar coluna obrigatória sem default; mudar tipo; remover valor de enum; criar constraint que os dados atuais violam.

Uma mudança destrutiva vira dois deploys:

1. Migration aditiva, com código que funciona com o schema antigo e com o novo.
2. Com o deploy 1 no ar e estável, a migration que remove o antigo.

## Regra 2: rollback da Vercel não desfaz migration

Instant Rollback e promover um deploy antigo trocam só o código. O banco continua com o schema novo, e é por isso que a regra 1 existe: o código antigo precisa funcionar com ele.

Para desfazer uma mudança de schema, crie uma **migration corretiva nova**, revisada em PR. `prisma migrate resolve --rolled-back` só altera o histórico do Prisma, não o banco.

## Quando a migration falha no deploy

Uma migration **não é atômica**: se o terceiro comando de um arquivo falha, os dois primeiros ficam aplicados. Por isso, prefira um passo arriscado por migration e SQL que aceita reexecução (`IF NOT EXISTS`).

Depois de uma falha, a migration fica marcada como falha no banco, e **todo deploy de produção seguinte falha com `P3009`**, inclusive um deploy que só corrige código, até alguém resolver:

1. No log do build, veja qual migration e qual comando falharam.
2. Com a conexão direta, confira no banco o que ficou aplicado.
3. Escolha um caminho:
   - desfaça à mão o que ficou pela metade e rode `npx prisma migrate resolve --rolled-back <nome>`; depois corrija a migration por PR;
   - ou complete à mão o que faltou e rode `npx prisma migrate resolve --applied <nome>`.
4. Faça o deploy de novo e confira `npx prisma migrate status`.

Os comandos acima rodam em `web/`, com `DATABASE_URL` apontando para a URL direta de produção.
