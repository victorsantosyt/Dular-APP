# Baseline das migrations Prisma

## Diagnostico

A cadeia antiga de migrations nao recriava o schema do zero. Em ordem cronologica, a primeira migration ativa era:

```text
20250211120000_add_avatar_url
```

Ela executava:

```sql
ALTER TABLE "User" ADD COLUMN "avatarUrl" TEXT;
```

Isso quebra o shadow database com P3006/P1014 porque a tabela `User` so era criada depois, na migration:

```text
20260108054209_diarista_profile_ativo
```

Tambem havia campos/modelos no `schema.prisma` atual que nao eram reconstruidos de forma completa pelo historico antigo, como `IncidentReport`, `SafetyEvent`, `SafeScore`, `pushToken`, `precoMedio` e `anonimo`.

## Correcao aplicada no repositorio

O historico antigo foi preservado, mas saiu da pasta ativa do Prisma:

```text
web/prisma/migrations_archive/pre_baseline/
```

A pasta ativa ficou com uma migration de baseline:

```text
web/prisma/migrations/0_init/migration.sql
```

Ela foi gerada a partir do schema real do banco existente, introspectado antes da reconciliacao. Esse baseline representa o estado ja aplicado no banco remoto antes das migrations novas.

Comando usado para introspectar sem sobrescrever `schema.prisma`:

```bash
npx prisma db pull --print > /tmp/dular_db_schema.prisma
```

Comando usado para gerar o baseline com Prisma 7:

```bash
npx prisma migrate diff \
  --from-empty \
  --to-schema /tmp/dular_db_schema.prisma \
  --script \
  --output prisma/migrations/0_init/migration.sql
```

Observacao: em Prisma 7, `--to-schema-datamodel` foi removido. Use `--to-schema`.

As migrations pendentes foram mantidas ativas depois do baseline:

```text
web/prisma/migrations/20260428030000_add_preco_medio
web/prisma/migrations/20260428040000_add_safescore
web/prisma/migrations/20260428050000_add_incident_anonimo
```

## Antes de aplicar em um banco existente

Nao rode `migrate resolve` ou `migrate dev` contra um banco real sem backup da tabela de historico.

No ambiente atual, nao ha Postgres local configurado para validar `migrate dev` com seguranca. O `DATABASE_URL` carregado pelo Prisma aponta para um banco Railway remoto.

Backup sugerido da tabela `_prisma_migrations`:

```bash
pg_dump "$DATABASE_URL" \
  --table public._prisma_migrations \
  --data-only \
  --column-inserts \
  > _prisma_migrations_backup.sql
```

Depois de validar que o schema do banco existente corresponde ao baseline `0_init`, marque o baseline como aplicado:

```bash
npx prisma migrate resolve --applied 0_init
```

Em seguida aplique as migrations pendentes e valide:

```bash
npx prisma migrate deploy
npx prisma migrate status
npx prisma validate
```

O resultado esperado de `npx prisma migrate status`, depois da reconciliacao do banco correto, e `Database schema is up to date`.

Para banco novo de producao, prefira:

```bash
npx prisma migrate deploy
```

## Estado das migrations novas

As mudancas de `add_preco_medio`, `add_safescore` e `add_incident_anonimo` ficam depois do baseline e sao aplicadas por `npx prisma migrate deploy`.

## Execucao realizada

Em 2026-04-28, o fluxo foi executado contra o banco Railway configurado em `DATABASE_URL`:

```bash
pg_dump "$DATABASE_URL" > backup_pre_baseline.sql
npx prisma migrate resolve --applied 0_init
npx prisma migrate deploy
npx prisma migrate status
npx prisma validate
```

Resultado:

```text
Migration 0_init marked as applied.
Applying migration `20260428030000_add_preco_medio`
Applying migration `20260428040000_add_safescore`
Applying migration `20260428050000_add_incident_anonimo`
All migrations have been successfully applied.
Database schema is up to date!
```
