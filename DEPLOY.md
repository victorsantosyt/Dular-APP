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
  - `customer.subscription.updated`, `customer.subscription.pending_update_applied`, `customer.subscription.pending_update_expired`, `checkout.session.expired` — troca de plano (`lib/trocaDePlano`). Sem eles a troca ainda é retomada pela varredura do servidor, mas só no próximo boot ou intervalo
- [ ] `STRIPE_WEBHOOK_SECRET` copiado do endpoint webhook de produção
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
