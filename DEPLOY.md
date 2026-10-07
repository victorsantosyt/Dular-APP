# Deploy Dular

Use este checklist antes do primeiro deploy. Execute os comandos a partir da raiz indicada em cada passo e nunca use segredos reais em arquivos `.example`.

## PRÉ-DEPLOY (Backend)

- [ ] Banco Postgres provisionado (Railway, Supabase ou RDS)
- [ ] Confirmar se o banco e novo ou se ja tem dados reais
- [ ] Se o banco ja existir, fazer backup de `public._prisma_migrations` antes de qualquer `migrate resolve`
- [ ] Todas as variáveis de ambiente configuradas
- [ ] `cd web && npx prisma validate` rodado com sucesso
- [ ] Migrations: o deploy de produção na Vercel roda `prisma migrate deploy` sozinho (regras em `docs/migrations-em-producao.md`); toda migration em `main` precisa ser aditiva
- [ ] `cd web && npx prisma migrate status` confirmando todas as migrations como aplicadas
- [ ] `cd web && npm run seed:prod` rodado com `PROD_ADMIN_EMAIL`/`PROD_ADMIN_PASSWORD` e `PILOT_CITY`/`PILOT_UF`/`PILOT_BAIRROS` definidos (cria admin inicial + bairros da cidade piloto; idempotente)
- [ ] NUNCA rodar o seed de desenvolvimento (`prisma db seed`) em produção — ele cria usuários demo e é bloqueado com `NODE_ENV=production`
- [ ] Bucket S3 criado com política de acesso correta
- [ ] Domínio configurado e HTTPS ativo

## DEPLOY WEB (Vercel)

- [ ] Repositório conectado à Vercel
- [ ] Root directory configurado como `web`
- [ ] Variáveis de ambiente de `web/.env.production.example` adicionadas no painel Vercel
- [ ] `DATABASE_URL_UNPOOLED` (conexão direta, sem pooler) disponível no ambiente Production
- [ ] Build command: vem de `web/vercel.json` (`bash scripts/vercel-build.sh`); não sobrescrever no painel
- [ ] Output directory: `web/.next`
- [ ] `npx prisma generate` no build (ja incluido em `web/package.json`, chamado pelo script)
- [ ] Webhook do Stripe apontando para URL de produção: `https://SEU_DOMINIO/api/webhooks/stripe`
- [ ] Eventos assinados nesse endpoint — os da compra e do ciclo de vida, mais os da troca de plano:
  - `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`
  - `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`
  - `customer.subscription.updated`, `customer.subscription.pending_update_applied`, `customer.subscription.pending_update_expired`, `checkout.session.expired` — troca de plano (`lib/trocaDePlano`). Sem eles, uma troca paga depois na fatura fica cobrada sem o plano no banco até a próxima varredura (boot, intervalo ou cron diário), e o cancelamento de assinatura duplicada perde o gatilho da virada do período
  - `invoice.created` — **obrigatório**: é o aviso do rascunho da renovação. Para uma assinatura substituída (duplicada), o webhook grava o cancelamento antes de responder 2xx e, em seguida, cancela a assinatura e anula o rascunho antes de a Stripe cobrar (cerca de 1 h depois). Sem este evento, a duplicada só é barrada se outro gatilho agir nessa hora; se não agir, a renovação é cobrada e vira caso de revisão manual
- [ ] Conta Stripe **live**, só leitura: listar Payment Links e pricing tables. O webhook não cria nem troca vínculo de sessão sem prova de origem (`lib/origemDoCheckout`). Se houver sessões assim, cada uma vira caso `checkout_sem_prova` para revisão manual, e quem pagou fica com uma assinatura sem vínculo até alguém decidir o estorno
- [ ] Usuários **sem e-mail** que estiverem com Checkout aberto na hora do deploy: a sessão criada pela versão anterior só é aceita com o e-mail do usuário igual ao da sessão. Sem isso, vira caso `checkout_sem_prova`
- [ ] Assinaturas duplicadas que já existem: levantamento só leitura **antes** do deploy (procedimento no PR #348). A duplicada só é cancelada automaticamente se `metadata.userId` for o mesmo usuário; sem ele (anteriores ao #347), a operação falha com `antiga_sem_dono_provado` até alguém conferir a dona e gravar o `userId`
- [ ] `STRIPE_WEBHOOK_SECRET` copiado do endpoint webhook de produção
- [ ] `CRON_SECRET` no ambiente **Production**: aleatório, com 16 caracteres ou mais (ex.: `openssl rand -hex 32`), exclusivo deste uso. A Vercel o envia como `Authorization: Bearer …` ao chamar o cron. Sem ele, `/api/cron/reconciliar-stripe` recusa com 503 e a reconciliação das operações Stripe com hora marcada não roda
- [ ] Cron `/api/cron/reconciliar-stripe` listado em Settings → Cron Jobs depois do deploy de produção. Vem do `web/vercel.json`: diário, `17 6 * * *` (06:17 UTC). No plano Hobby o cron só pode rodar uma vez por dia, com folga de até 59 min, e uma expressão mais frequente faz o deploy falhar. No Pro pode ser mais frequente (ex.: `*/10 * * * *`)
- [ ] Deploy criado e rota `/api/health` validada

## DEPLOY MOBILE (Expo EAS)

- [ ] `dular-mobile/.env.production.example` usado como base para as variáveis de produção
- [ ] `EXPO_PUBLIC_API_URL` apontando para produção
- [ ] `cd dular-mobile && eas build --platform all` rodado
- [ ] Push notifications configuradas (Expo + FCM + APNs)
- [ ] Deep links testados para login OAuth e billing
- [ ] App submetido para revisão (App Store / Play Store)

## PÓS-DEPLOY

- [ ] Executar o smoke test oficial do Beta (12 passos + pré/pós-checks): procedimento em `auditoria/14-smoke-test-producao.md` (doc operacional local, fora do git)
- [ ] Testar fluxo completo: cadastro → busca → contratação → execução → confirmação → avaliação
- [ ] Verificar que SOS registra no banco de produção
- [ ] Verificar que KYC envia para S3 correto
- [ ] Verificar recebimento de push notification em dispositivo real
- [ ] Verificar webhook Stripe com evento real ou modo test
- [ ] Rodar o cron uma vez pelo botão Run em Settings → Cron Jobs e conferir em View Logs: `200` com `falhas: 0`. `503` significa `CRON_SECRET` ausente ou curto
- [ ] No endpoint de webhook da Stripe (Dashboard → Webhooks), conferir que `invoice.created` está sendo entregue com `200`. Uma resposta diferente de 2xx faz a Stripe adiar a finalização das faturas automáticas por até 72 h
- [ ] Rotina de revisão: consultar `GET /api/ops/stripe-operacoes` (admin) e tratar `revisoes` abertas — `renovacao_paga_da_substituida` (renovação de duplicada já cobrada) e `checkout_sem_prova` (sessão paga sem prova de origem). Nada é estornado nem avisado automaticamente: só esta fila registra o caso
- [ ] Monitorar logs nas primeiras 24h

## ROLLBACK

**Rollback da Vercel não desfaz migration.** Ele troca só o código; o banco continua com o schema novo. Para desfazer schema, crie uma migration corretiva nova por PR. Se uma migration falhou no deploy, todo deploy seguinte falha com `P3009` até ela ser resolvida: procedimento em `docs/migrations-em-producao.md`.

Se uma migration foi marcada/aplicada por engano, primeiro pare novos deploys e confirme o estado real do banco. Para marcar uma migration como revertida no historico do Prisma:

```bash
cd web
npx prisma migrate resolve --rolled-back MIGRATION_NAME
```

Esse comando altera somente o historico do Prisma; ele nao desfaz colunas/tabelas automaticamente. Se a migration executou SQL destrutivo, restaure backup ou aplique uma migration corretiva revisada.

Para reverter deploy na Vercel:

- Abra o projeto na Vercel
- Entre em Deployments
- Selecione o ultimo deploy estavel
- Use Instant Rollback (não reconstrói nem migra). Evite "Promote to Production" de um preview como rollback: ele reconstrói como produção e aplica as migrations daquela branch

Depois do rollback, valide `/api/health`, login, criacao de servico e logs do webhook Stripe.
