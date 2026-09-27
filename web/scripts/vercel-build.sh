#!/usr/bin/env bash
# Build da Vercel (buildCommand em web/vercel.json).
#
# Migration só com VERCEL_ENV=production, antes do build: se falhar, o deploy
# falha e a versão anterior continua no ar. Preview e development nunca migram,
# mesmo que as variáveis do banco deles apontem para produção.
#
# Disciplina que isto exige (docs/migrations-em-producao.md):
# - toda migration em main precisa ser aditiva: o código que ainda está no ar
#   tem que continuar funcionando contra o schema novo;
# - rollback da Vercel NÃO desfaz migration.
set -euo pipefail

cd "$(dirname "$0")/.."

ambiente="${VERCEL_ENV:-}"

if [ "$ambiente" = "production" ]; then
  if [ -z "${DATABASE_URL_UNPOOLED:-}" ]; then
    echo "[vercel-build] ERRO: VERCEL_ENV=production sem DATABASE_URL_UNPOOLED; nada foi migrado." >&2
    exit 1
  fi
  case "$DATABASE_URL_UNPOOLED" in
    *-pooler.*)
      echo "[vercel-build] ERRO: DATABASE_URL_UNPOOLED aponta para o pooler; migrate deploy precisa da conexão direta." >&2
      exit 1
      ;;
  esac

  # Só o host vai para o log, nunca usuário ou senha.
  host="${DATABASE_URL_UNPOOLED#*@}"
  host="${host%%/*}"
  host="${host%%\?*}"
  echo "[vercel-build] VERCEL_ENV=production: prisma migrate deploy em ${host}"
  DATABASE_URL="$DATABASE_URL_UNPOOLED" npx prisma migrate deploy
  echo "[vercel-build] migrations aplicadas"
elif [ "$ambiente" = "preview" ]; then
  # Preview só builda contra o banco de STAGING, provado por três evidências
  # (variável, host anotado e marca no banco). Qualquer desvio falha o build:
  # um preview nunca sobe apontando para produção. Não migra.
  echo "[vercel-build] VERCEL_ENV=preview: conferindo o banco de staging"
  node scripts/staging/confirmar-banco.mjs
  echo "[vercel-build] migrations não rodam fora de produção"
else
  echo "[vercel-build] VERCEL_ENV=${ambiente:-<vazio>}: migrations não rodam fora de produção"
fi

npm run build
