# Pagamento PIX (P2P) — Arquitetura e Fluxo

> O pagamento do serviço é feito **diretamente do empregador para o profissional**
> via PIX. **A Dular não recebe, não intermedia e não retém valores** — a
> plataforma apenas facilita, gerando o PIX Copia e Cola/QR Code e registrando
> o ciclo de confirmação entre as partes.

## Regras invioláveis

1. **Valor**: sempre `Servico.precoFinal` (centavos, congelado na contratação).
   Nunca editável, nunca vindo do frontend.
2. **TxId**: sempre o `Servico.id` (cuid, cabe no limite de 25 chars do BR Code)
   — rastreabilidade transação ↔ serviço.
3. **Chave/nome**: sempre do `PaymentInfo` do profissional do serviço.
4. O frontend **apenas solicita** — o backend monta chave, valor, txid,
   descrição e o payload EMV completo.
5. A chave PIX nunca aparece completa em logs (`maskPixKey`).

## Banco (migration `20260707120000_add_pix_payment`)

- **`PaymentInfo`** — dados de recebimento do profissional (1:1 `User`):
  `pixType` (`CPF|CELULAR|EMAIL|ALEATORIA`), `pixKey` (normalizada), `bank?`,
  `holderName`, timestamps.
- **`Servico.paymentStatus`** (`PaymentStatus`, default `WAITING_PAYMENT`) +
  `paymentReportedAt/ConfirmedAt/DisputedAt`.
- **`PaymentEvent`** — trilha de auditoria (espelho de `ServicoEvento`):
  `tipo` (`PIX_GENERATED|PIX_COPIED|PAYMENT_REPORTED|PAYMENT_CONFIRMED|PAYMENT_DISPUTED`),
  `actorId`, `actorRole`, `motivo?`, `createdAt`.

### Máquina de estados

```
WAITING_PAYMENT ──informar (EMPREGADOR)──▶ PAYMENT_REPORTED
PAYMENT_REPORTED ──confirmar (PROFISSIONAL)──▶ PAYMENT_CONFIRMED  (terminal)
PAYMENT_REPORTED ──contestar+motivo (PROFISSIONAL)──▶ PAYMENT_DISPUTED
PAYMENT_DISPUTED ──informar (EMPREGADOR)──▶ PAYMENT_REPORTED     (re-tentativa)
```

Geração do PIX permitida em `WAITING_PAYMENT` e `PAYMENT_DISPUTED`, e somente
com o serviço "contratado e ativo" (`ACEITO → FINALIZADO`, nunca
`RASCUNHO/SOLICITADO/RECUSADO/CANCELADO`) — `PIX_STATUSES_ELEGIVEIS` em
`web/src/lib/pagamentoPix.ts`.

## Endpoints (todas com autenticação dual JWT próprio → sessão NextAuth)

| Endpoint | Quem | Efeito |
|---|---|---|
| `GET/PUT /api/me/payment-info` | DIARISTA/MONTADOR | lê/upserta a chave PIX (validação CPF/celular/email/UUID em `lib/pixKey.ts`) |
| `POST /api/servicos/[id]/pix` | empregador dono | gera Copia e Cola (EMV BR Code) — ignora o body; loga `PIX_GENERATED` |
| `POST /api/servicos/[id]/pix/copiado` | empregador dono | loga `PIX_COPIED` |
| `POST /api/servicos/[id]/pagamento/informar` | empregador dono | → `PAYMENT_REPORTED` + notificação push + mensagem SYSTEM no chat |
| `POST /api/servicos/[id]/pagamento/confirmar` | profissional do serviço | → `PAYMENT_CONFIRMED` + push + SYSTEM |
| `POST /api/servicos/[id]/pagamento/contestar` | profissional do serviço | body `{ motivo }` obrigatório → `PAYMENT_DISPUTED` + push + SYSTEM |

Autorização em toda rota: token → participante correto do serviço (dono OU
profissional, conforme a ação) → serviço existente → status elegível → estado
de pagamento válido (409 caso contrário).

## Geração do BR Code (`web/src/lib/pix.ts`)

Payload EMV®-QRCPS-MPM estático: `26` (GUI `br.gov.bcb.pix` + chave +
descrição), `52=0000`, `53=986`, `54=valor` (centavos→decimal), `58=BR`,
`59=nome` (≤25, sem diacríticos), `60=cidade` (≤15), `62-05=txid`,
`63=CRC16/CCITT-FALSE`. Validado por: vetor canônico do CRC (`29B1`),
igualdade byte a byte com a lib de referência `pix-utils` e round-trip pelo
parser dela (CRC checado). Testes em `web/test/security/pix.test.ts`.

O QR Code é **sempre** renderizado a partir do Copia e Cola retornado pelo
backend: `react-qr-code` (web) e `react-native-qrcode-svg` (mobile).

## Tempo real

Mesmo mecanismo do restante do app: polling de 8s do chat (o `GET
/api/chat/[roomId]` agora retorna `servico.paymentStatus`, `servico.precoFinal`
e `pagamento.profissionalTemPix`) + notificação push/in-app (`criarNotificacao`,
tipos `PAGAMENTO_INFORMADO/CONFIRMADO/CONTESTADO`) + mensagem `SYSTEM` na
própria conversa.

## UI

- **Mobile** — Perfil (diarista/montador) → "Recebimentos"
  (`screens/shared/RecebimentosScreen.tsx`, rota `Recebimentos` nos dois
  navigators). Chat: banner condicional (`PagamentoChatBanner`) — empregador vê
  `Pagamento — [Pagar com PIX]` quando serviço contratado + profissional com
  chave + pagamento pendente/contestado; abre `PixPagamentoModal` (QR, Copia e
  Cola, copiar, "Já realizei o pagamento" com confirmação). Profissional vê
  "[Confirmar recebimento] / [Ainda não recebi]" (motivo) quando informado.
- **Web** — `/diarista/recebimentos` e `/montador/recebimentos`
  (`RecebimentosForm`) e `/servicos/[id]/pagamento` (`PixPagamentoPanel`, ambos
  os papéis). Mesmo fluxo funcional do mobile.

## Testes

`web/test/security/pix.test.ts` (EMV/CRC/sanitização/validação de chave) e
`web/test/security/routes-pagamento-pix.test.ts` (autenticação, autorização,
dono/profissional corretos, estados, motivo obrigatório, valor imune ao body).
Suíte completa: `npm run test:security`.
