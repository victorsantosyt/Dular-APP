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

## Atenção: preview usa o banco de produção

`DATABASE_URL`, `DATABASE_URL_UNPOOLED` e as demais variáveis do Neon são **uma variável só para Production, Preview e Development**. O script garante que um preview não migra, mas o código de qualquer branch em preview lê e grava no banco de produção. Separar isso (branch do Neon por preview, ou variáveis próprias de Preview) é uma mudança de configuração pendente.

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
