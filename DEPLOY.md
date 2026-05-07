# Deploy Dular

Use este checklist antes do primeiro deploy. Execute os comandos a partir da raiz indicada em cada passo e nunca use segredos reais em arquivos `.example`.

## PRÉ-DEPLOY (Backend)

- [ ] Banco Postgres provisionado (Railway, Supabase ou RDS)
- [ ] Confirmar se o banco e novo ou se ja tem dados reais
- [ ] Se o banco ja existir, fazer backup de `public._prisma_migrations` antes de qualquer `migrate resolve`
- [ ] Todas as variáveis de ambiente configuradas
- [ ] `cd web && npx prisma validate` rodado com sucesso
- [ ] `cd web && npx prisma migrate deploy` rodado no banco de produção
- [ ] `cd web && npx prisma migrate status` confirmando todas as migrations como aplicadas
- [ ] Bucket S3 criado com política de acesso correta
- [ ] Domínio configurado e HTTPS ativo

## DEPLOY WEB (Vercel)

- [ ] Repositório conectado à Vercel
- [ ] Root directory configurado como raiz do monorepo ou build command apontando para `web`
- [ ] Variáveis de ambiente de `web/.env.production.example` adicionadas no painel Vercel
- [ ] Build command: `cd web && npm run build`
- [ ] Output directory: `web/.next`
- [ ] `npx prisma generate` no build (ja incluido em `web/package.json`)
- [ ] Webhook do Stripe apontando para URL de produção: `https://SEU_DOMINIO/api/webhooks/stripe`
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

- [ ] Testar fluxo completo: cadastro → busca → contratação → execução → confirmação → avaliação
- [ ] Verificar que SOS registra no banco de produção
- [ ] Verificar que KYC envia para S3 correto
- [ ] Verificar recebimento de push notification em dispositivo real
- [ ] Verificar webhook Stripe com evento real ou modo test
- [ ] Monitorar logs nas primeiras 24h

## ROLLBACK

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
- Clique em Redeploy ou Promote to Production, conforme a configuracao do projeto

Depois do rollback, valide `/api/health`, login, criacao de servico e logs do webhook Stripe.
