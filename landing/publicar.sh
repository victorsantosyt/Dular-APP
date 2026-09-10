#!/usr/bin/env bash
#
# publicar.sh — sobe a landing para a Vercel e CONFERE que subiu mesmo.
#
# Por que existe: a landing é um projeto Vercel separado e não faz deploy
# automático por git. Merjar na main não publica nada. Sem isto, a única
# forma de saber se o que está no ar é o que está no repositório era
# conferir na mão.
#
# O passo de conferência não é decoração. Um deploy que responde 200 com o
# HTML antigo é o modo de falha real aqui, e ele passa despercebido: a
# página abre, só que velha.
#
# Uso:
#   ./landing/publicar.sh              publica e confere
#   ./landing/publicar.sh --dry-run    mostra o que faria, sem publicar
#   ./landing/publicar.sh --so-conferir  só compara o que está no ar
#
set -euo pipefail

LANDING="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOMINIO="${DULAR_LANDING_DOMINIO:-dular-landing.vercel.app}"
VERCEL_VERSAO="${DULAR_VERCEL_VERSAO:-vercel@59.15.1}"
# Pinado de propósito, mas com um piso: a API da Vercel recusa CLI velha
# ("This endpoint requires version 47.2.2 or later"), e o erro que ela
# devolve antes disso é enganoso — fala em não conseguir ler as
# configurações do projeto, como se fosse vínculo ou permissão.
# Se voltar a acontecer, suba este número.

MODO="publicar"
case "${1:-}" in
  --dry-run)     MODO="dry" ;;
  --so-conferir) MODO="conferir" ;;
  "")            ;;
  *) echo "opção desconhecida: $1"; exit 2 ;;
esac

msg()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
ruim() { printf '  \033[31m✗\033[0m %s\n' "$*"; }

# md5 portátil: macOS tem `md5`, Linux (e o runner do GitHub) tem `md5sum`.
soma() {
  if command -v md5sum >/dev/null 2>&1; then md5sum | cut -d' ' -f1
  else md5 -q
  fi
}

# ---------------------------------------------------------------------------
# 1) A versão dos assets é a impressão digital deles
# ---------------------------------------------------------------------------
# Os mockups mudam de conteúdo mantendo o nome do arquivo. Sem um ?v= novo,
# o navegador e a CDN seguem servindo o antigo — foi exatamente o que
# aconteceu quando as telas foram trocadas e pareciam não ter mudado.
# Usar a impressão digital, e não um contador, faz o valor mudar sozinho
# quando (e só quando) algum asset muda.
impressao_digital() {
  cat "$LANDING"/img/*.webp "$LANDING"/dular-mark.png 2>/dev/null | soma | cut -c1-8
}

VER="$(impressao_digital)"

versao_no_html() {
  grep -o 'app-perfil\.webp?v=[a-z0-9]*' "$LANDING/index.html" | head -1 | sed 's/.*?v=//'
}

carimbar_versao() {
  python3 - "$LANDING/index.html" "$1" <<'PY'
import io, re, sys
caminho, ver = sys.argv[1], sys.argv[2]
s = io.open(caminho, encoding="utf-8").read()
antes = s
# pega tanto o que já tem ?v= quanto o que ainda não tem
s = re.sub(r'(img/app-[a-z0-9\-]+\.webp)(\?v=[A-Za-z0-9]+)?', r'\1?v=' + ver, s)
if s != antes:
    io.open(caminho, "w", encoding="utf-8").write(s)
    print("carimbado")
else:
    print("já estava")
PY
}

# ---------------------------------------------------------------------------
# 2) Conferência: o que está no ar é o que está aqui?
# ---------------------------------------------------------------------------
conferir() {
  local ver_esperada="$1"
  local falhas=0

  msg "Conferindo https://$DOMINIO"

  local http
  http=$(curl -s -o /tmp/_dular_ao_vivo.html -w '%{http_code}' -m 30 "https://$DOMINIO/" || echo 000)
  if [ "$http" != "200" ]; then
    ruim "a página respondeu HTTP $http"
    return 1
  fi
  ok "página responde 200"

  local ver_ar
  ver_ar=$(grep -o 'app-perfil\.webp?v=[a-z0-9]*' /tmp/_dular_ao_vivo.html | head -1 | sed 's/.*?v=//')
  if [ "$ver_ar" = "$ver_esperada" ]; then
    ok "versão dos assets no ar = $ver_ar (bate com o local)"
  else
    ruim "versão no ar = '${ver_ar:-nenhuma}', esperada '$ver_esperada' — o deploy não pegou"
    falhas=$((falhas+1))
  fi

  # o HTML pode estar novo e a imagem velha: são caches diferentes
  local local_bytes ar_bytes
  local_bytes=$(wc -c < "$LANDING/img/app-perfil.webp" | tr -d ' ')
  ar_bytes=$(curl -s -o /dev/null -w '%{size_download}' -m 30 "https://$DOMINIO/img/app-perfil.webp?v=$ver_esperada" || echo 0)
  if [ "$local_bytes" = "$ar_bytes" ]; then
    ok "mockup do hero no ar tem os mesmos $ar_bytes bytes do local"
  else
    ruim "mockup do hero: $ar_bytes bytes no ar, $local_bytes no local"
    falhas=$((falhas+1))
  fi

  # o fundo escuro é o sinal mais barato de "esta é a versão nova"
  if grep -q 'content="#1e1e21"' /tmp/_dular_ao_vivo.html; then
    ok "tema escuro presente (theme-color #1e1e21)"
  else
    ruim "theme-color não é #1e1e21 — provavelmente é a versão anterior"
    falhas=$((falhas+1))
  fi

  rm -f /tmp/_dular_ao_vivo.html
  return $falhas
}

# ---------------------------------------------------------------------------
# 3) Execução
# ---------------------------------------------------------------------------
msg "Landing do Dular → Vercel"
echo "  pasta:    $LANDING"
echo "  domínio:  $DOMINIO"
echo "  versão:   $VER  (impressão digital dos assets)"
echo "  no HTML:  $(versao_no_html || echo 'nenhuma')"

if [ "$MODO" = "conferir" ]; then
  conferir "$(versao_no_html)" && { msg "No ar e conferido."; exit 0; } || { msg "Divergência encontrada."; exit 1; }
fi

if [ "$MODO" = "dry" ]; then
  msg "Versão dos assets"
  echo "  carimbaria '$VER' (dry-run não escreve no index.html)"
else
  msg "Carimbando a versão nos assets"
  echo "  $(carimbar_versao "$VER")"
fi

# O link do projeto vive em landing/.vercel, que é gitignorado. Na CI ele não
# existe, então os ids vêm por variável de ambiente.
if [ -f "$LANDING/.vercel/project.json" ]; then
  export VERCEL_ORG_ID="${VERCEL_ORG_ID:-$(python3 -c "import json;print(json.load(open('$LANDING/.vercel/project.json'))['orgId'])")}"
  export VERCEL_PROJECT_ID="${VERCEL_PROJECT_ID:-$(python3 -c "import json;print(json.load(open('$LANDING/.vercel/project.json'))['projectId'])")}"
fi
if [ -z "${VERCEL_ORG_ID:-}" ] || [ -z "${VERCEL_PROJECT_ID:-}" ]; then
  ruim "sem VERCEL_ORG_ID/VERCEL_PROJECT_ID e sem landing/.vercel/project.json"
  exit 1
fi
ok "projeto: $VERCEL_PROJECT_ID"

# ---------------------------------------------------------------------------
# O diagnóstico vem ANTES de qualquer comando da CLI
# ---------------------------------------------------------------------------
# A CLI responde "Could not retrieve Project Settings" para causas bem
# diferentes — token sem escopo, id errado, versão velha — e ainda sugere
# remover o .vercel, que na CI nem existe. Perguntando à API primeiro, o
# job falha dizendo qual é, em vez de deixar a pessoa adivinhando.
if [ -n "${VERCEL_TOKEN:-}" ]; then
  msg "Conferindo o token antes de falar com a CLI"

  http=$(curl -s -o /tmp/_dular_user.json -w '%{http_code}' -m 20 \
    -H "Authorization: Bearer $VERCEL_TOKEN" https://api.vercel.com/v2/user || echo 000)
  if [ "$http" != "200" ]; then
    ruim "o token nem autentica — HTTP $http"
    echo "  Crie outro em vercel.com/account/tokens e troque o secret VERCEL_TOKEN."
    rm -f /tmp/_dular_user.json; exit 1
  fi
  ok "o token autentica ($(python3 -c "import json;d=json.load(open('/tmp/_dular_user.json'));u=d.get('user',d);print(u.get('username') or u.get('email'))" 2>/dev/null || echo '?'))"
  rm -f /tmp/_dular_user.json

  # Este é o teste que separa as causas: um token com escopo errado autentica
  # normalmente e mesmo assim não enxerga o time dono do projeto.
  curl -s -m 20 -H "Authorization: Bearer $VERCEL_TOKEN" https://api.vercel.com/v2/teams > /tmp/_dular_teams.json || true
  if python3 - "$VERCEL_ORG_ID" <<'PY'
import json, sys
try:
    times = json.load(open("/tmp/_dular_teams.json")).get("teams", [])
except Exception:
    times = []
alvo = sys.argv[1]
print("  times visíveis: " + (", ".join(f"{t.get('slug')} ({t.get('id')})" for t in times) or "nenhum"))
sys.exit(0 if any(t.get("id") == alvo for t in times) else 1)
PY
  then
    ok "o token enxerga o time dono do projeto"
  else
    ruim "o token NÃO enxerga o time $VERCEL_ORG_ID"
    echo ""
    echo "  É o escopo do token. Em vercel.com/account/tokens, ao criar, o"
    echo "  campo Scope precisa ser o time dono do projeto — não a conta"
    echo "  pessoal. O time aqui é:"
    echo ""
    echo "      victorsantosyts-projects"
    echo ""
    echo "  Recrie com esse escopo e troque o secret VERCEL_TOKEN."
    rm -f /tmp/_dular_teams.json; exit 1
  fi
  rm -f /tmp/_dular_teams.json

  http=$(curl -s -o /tmp/_dular_proj.json -w '%{http_code}' -m 20 \
    -H "Authorization: Bearer $VERCEL_TOKEN" \
    "https://api.vercel.com/v9/projects/$VERCEL_PROJECT_ID?teamId=$VERCEL_ORG_ID" || echo 000)
  if [ "$http" = "200" ]; then
    ok "o token lê o projeto ($(python3 -c "import json;print(json.load(open('/tmp/_dular_proj.json'))['name'])" 2>/dev/null || echo '?'))"
  else
    ruim "o token autentica e vê o time, mas não lê o projeto — HTTP $http"
    echo "  resposta: $(head -c 300 /tmp/_dular_proj.json 2>/dev/null)"
    rm -f /tmp/_dular_proj.json; exit 1
  fi
  rm -f /tmp/_dular_proj.json
fi

# O vínculo que a CLI procura é landing/.vercel/project.json, gitignorado e
# portanto ausente na CI. Quem o monta completo — com o bloco `settings`, que
# um arquivo escrito à mão com os dois ids não teria — é o `pull`.
if [ ! -f "$LANDING/.vercel/project.json" ]; then
  msg "Vinculando o projeto (não há landing/.vercel — é o caso da CI)"
  PULL=(pull --yes --environment=production)
  [ -n "${VERCEL_TOKEN:-}" ] && PULL+=(--token "$VERCEL_TOKEN" --scope "$VERCEL_ORG_ID")
  ( cd "$LANDING" && npx --yes "$VERCEL_VERSAO" "${PULL[@]}" ) || {
    ruim "o pull falhou mesmo com o token conferido acima"
    exit 1
  }
  [ -f "$LANDING/.vercel/project.json" ] && ok "vínculo criado" || { ruim "o pull não criou o vínculo"; exit 1; }
fi

ARGS=(deploy --prod --yes)
# Local: a CLI usa o login salvo. Na CI: precisa de VERCEL_TOKEN, e o --scope
# evita que ela tente adivinhar o time a partir do token.
[ -n "${VERCEL_TOKEN:-}" ] && ARGS+=(--token "$VERCEL_TOKEN" --scope "$VERCEL_ORG_ID")

if [ "$MODO" = "dry" ]; then
  msg "DRY RUN — nada foi publicado"
  echo "  rodaria: npx --yes $VERCEL_VERSAO ${ARGS[*]//${VERCEL_TOKEN:-__nada__}/***}"
  echo "  em:      $LANDING"
  echo ""
  echo "  e depois conferiria a versão '$VER' em https://$DOMINIO"
  exit 0
fi

msg "Publicando"
cd "$LANDING"
URL=$(npx --yes "$VERCEL_VERSAO" "${ARGS[@]}" 2>&1 | tee /dev/stderr | grep -Eo 'https://[a-z0-9.-]+\.vercel\.app' | tail -1)
[ -n "$URL" ] && ok "deploy: $URL" || ruim "não consegui ler a URL do deploy"

# A CDN leva alguns segundos para trocar a versão nas bordas.
msg "Esperando a borda atualizar"
for i in $(seq 1 12); do
  if curl -s -m 20 "https://$DOMINIO/" | grep -q "app-perfil.webp?v=$VER"; then
    ok "borda atualizada (tentativa $i)"
    break
  fi
  [ "$i" = "12" ] && ruim "a borda não trocou em ~60s"
  sleep 5
done

if conferir "$VER"; then
  msg "Publicado e conferido: https://$DOMINIO"
  exit 0
else
  msg "Publicou, mas a conferência falhou. O que está no ar NÃO é o que está aqui."
  exit 1
fi
